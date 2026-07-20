// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Campaign Worker
//
// Queue : whatsapp-campaigns
// Concurrency : 3  (external API rate-limit friendly)
//
// Jobs handled:
//   send-campaign — Dispatches all messages for a single WhatsApp campaign.
//                   - Resolves the target contact list from campaign filters.
//                   - Checks wallet balance before sending any messages.
//                   - Interpolates {{variable}} placeholders in the template.
//                   - Sends each message via the configured WhatsApp HTTP API.
//                   - Logs each send attempt (SENT / FAILED) to WhatsappLog.
//                   - Deducts cost from WhatsappWallet and records a transaction.
//                   - Updates the campaign status to COMPLETED or FAILED.
// ─────────────────────────────────────────────────────────────────────────────

import { OnWorkerEvent, Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { ConfigService }  from '@nestjs/config';
import {
  WHATSAPP_CAMPAIGN_QUEUE,
  WhatsappCampaignJob,
} from './queue.constants';

/** Job payload emitted by WhatsappService.scheduleCampaign() */
export interface SendCampaignJobData {
  campaignId: string;
  tenantId:   string;
}

/** Target-filter shape stored as JSON in WhatsappCampaign.targetFilters */
interface TargetFilters {
  tag?:            string;
  policyCategory?: string;
  gender?:         string;
  minAge?:         number;
  maxAge?:         number;
  contactIds?:     string[];
  targetAudience?: string;
  recurrence?:     string;
  frequency?:      string;
}

/** Credit cost per message (hardcoded; replace with plan-based pricing if needed) */
const COST_PER_MESSAGE = 1;

@Processor(WHATSAPP_CAMPAIGN_QUEUE, { concurrency: 3 })
export class WhatsappCampaignWorker extends WorkerHost {
  private readonly logger   = new Logger(WhatsappCampaignWorker.name);
  private readonly apiUrl:   string;
  private readonly apiToken: string;

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
    @InjectQueue(WHATSAPP_CAMPAIGN_QUEUE) private readonly campaignQueue: Queue,
  ) {
    super();
    this.apiUrl   = config.get<string>('whatsapp.apiUrl',   '');
    this.apiToken = config.get<string>('whatsapp.apiKey',   '');
  }

  // ── Entry point ────────────────────────────────────────────────────────────

  async process(job: Job<SendCampaignJobData>): Promise<void> {
    if (job.name !== WhatsappCampaignJob.SEND_CAMPAIGN) {
      this.logger.warn(`Unknown WhatsApp campaign job: "${job.name}"`);
      return;
    }
    return this.sendCampaign(job);
  }

  // ── Campaign dispatch ──────────────────────────────────────────────────────

  private async sendCampaign(job: Job<SendCampaignJobData>): Promise<void> {
    const { campaignId, tenantId } = job.data;
    this.logger.log(`Starting campaign ${campaignId} for tenant ${tenantId}`);

    // ── 1. Load campaign ────────────────────────────────────────────────────
    const campaign = await this.prisma.whatsappCampaign.findFirst({
      where:   { id: campaignId, tenantId },
      include: { template: true },
    });

    if (!campaign) {
      this.logger.warn(`Campaign ${campaignId} not found — aborting`);
      return;
    }

    if (campaign.status === 'COMPLETED' || campaign.status === 'RUNNING') {
      this.logger.warn(`Campaign ${campaignId} is already ${campaign.status} — skipping`);
      return;
    }

    // ── 2. Mark as RUNNING ──────────────────────────────────────────────────
    await this.prisma.whatsappCampaign.update({
      where: { id: campaignId },
      data:  { status: 'RUNNING' },
    });

    // ── 3. Resolve target contacts ──────────────────────────────────────────
    const filters = (campaign.targetFilters ?? {}) as TargetFilters;
    const contacts = await this.resolveContacts(tenantId, filters);

    if (contacts.length === 0) {
      this.logger.warn(`No contacts match campaign ${campaignId} filters`);
      await this.prisma.whatsappCampaign.update({
        where: { id: campaignId },
        data:  { status: 'FAILED' },
      });
      return;
    }

    // ── 4. Wallet balance check ─────────────────────────────────────────────
    const wallet = await this.prisma.whatsappWallet.findFirst({ where: { tenantId } });
    const balance = Number(wallet?.balance ?? 0);
    const totalCost = contacts.length * COST_PER_MESSAGE;

    if (balance < totalCost) {
      this.logger.error(
        `Insufficient wallet balance for campaign ${campaignId}: ` +
        `need ${totalCost}, have ${balance}`,
      );
      await this.prisma.whatsappCampaign.update({
        where: { id: campaignId },
        data:  { status: 'FAILED' },
      });
      return;
    }

    // ── 5. Send messages ────────────────────────────────────────────────────
    let sent   = 0;
    let failed = 0;

    for (const contact of contacts) {
      // Interpolate all {{variable}} placeholders
      const body = this.interpolateTemplate(campaign.template.body, {
        name:  contact.firstName,
        phone: contact.phone,
      });

      try {
        await this.sendMessage(contact.phone, body);

        await this.prisma.whatsappLog.create({
          data: {
            campaignId,
            phone:  contact.phone,
            status: 'SENT',
            sentAt: new Date(),
          },
        });
        sent++;
      } catch (err: any) {
        this.logger.warn(`Failed to send to ${contact.phone}: ${err?.message}`);
        await this.prisma.whatsappLog.create({
          data: {
            campaignId,
            phone:  contact.phone,
            status: 'FAILED',
            error:  err?.message ?? 'Unknown error',
          },
        });
        failed++;
      }

      // Update BullMQ job progress so dashboards can show live %
      await job.updateProgress(Math.round(((sent + failed) / contacts.length) * 100));
    }

    // ── 6. Deduct wallet balance (only for successfully sent messages) ───────
    const actualCost = sent * COST_PER_MESSAGE;
    if (actualCost > 0 && wallet) {
      await this.prisma.$transaction([
        this.prisma.whatsappWallet.update({
          where: { id: wallet.id },
          data:  { balance: { decrement: actualCost } },
        }),
        this.prisma.walletTransaction.create({
          data: {
            walletId:     wallet.id,
            amount:       actualCost,
            type:         'DEBIT',
            description:  `Campaign: ${campaign.name} (${sent} messages)`,
            balanceAfter: balance - actualCost,
          },
        }),
      ]);
    }

    // ── 7. Finalise campaign status ─────────────────────────────────────────
    const recurrence = filters.recurrence || filters.frequency;
    const isRecurring = recurrence && recurrence !== 'once';

    const finalStatus = sent === 0 ? 'FAILED' : 'COMPLETED';

    if (isRecurring && sent > 0) {
      let nextRun = new Date();
      if (recurrence === 'daily') {
        nextRun.setDate(nextRun.getDate() + 1);
      } else if (recurrence === 'weekly') {
        nextRun.setDate(nextRun.getDate() + 7);
      } else if (recurrence === 'monthly') {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }

      await this.prisma.whatsappCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'SCHEDULED',
          scheduledAt: nextRun,
          sentCount: { increment: sent },
        },
      });

      // Schedule delayed BullMQ job
      const delay = nextRun.getTime() - Date.now();
      await this.campaignQueue.add(
        'send-campaign',
        { campaignId, tenantId },
        { delay: Math.max(delay, 0), jobId: `campaign-${campaignId}-${nextRun.getTime()}` },
      );

      this.logger.log(
        `Campaign ${campaignId} processed (sent: ${sent}). Rescheduled for next run at: ${nextRun.toISOString()}`,
      );
    } else {
      await this.prisma.whatsappCampaign.update({
        where: { id: campaignId },
        data:  { status: finalStatus, sentCount: sent },
      });

      this.logger.log(
        `Campaign ${campaignId} ${finalStatus} — sent: ${sent}, failed: ${failed}`,
      );
    }
  }

  // ── Contact resolution from campaign filters ───────────────────────────────

  private async resolveContacts(
    tenantId: string,
    filters:  TargetFilters,
  ): Promise<Array<{ id: string; phone: string; firstName: string }>> {
    const where: any = { tenantId, isActive: true };

    if (filters.contactIds && filters.contactIds.length > 0) {
      where.id = { in: filters.contactIds };
    }

    if (filters.targetAudience) {
      if (filters.targetAudience === 'all-leads') {
        where.OR = [
          { leadStage: { not: null } },
          { productInterests: { some: {} } }
        ];
      } else if (filters.targetAudience === 'all-customers') {
        where.policies = { some: {} };
      } else if (filters.targetAudience === 'hot-leads') {
        where.OR = [
          { leadStage: 'HOT' },
          { tags: { has: 'hot' } }
        ];
      }
    }

    if (filters.tag) {
      where.tags = { has: filters.tag };
    }

    if (filters.gender) {
      where.gender = filters.gender;
    }

    if (filters.minAge !== undefined || filters.maxAge !== undefined) {
      const today = new Date();
      where.dateOfBirth = {};
      if (filters.maxAge !== undefined) {
        // born after (today - maxAge years)
        const earliest = new Date(today);
        earliest.setFullYear(today.getFullYear() - filters.maxAge);
        where.dateOfBirth.gte = earliest;
      }
      if (filters.minAge !== undefined) {
        // born before (today - minAge years)
        const latest = new Date(today);
        latest.setFullYear(today.getFullYear() - filters.minAge);
        where.dateOfBirth.lte = latest;
      }
    }

    if (filters.policyCategory) {
      where.policies = {
        some: {
          status: 'ACTIVE',
          plan:   { category: filters.policyCategory },
        },
      };
    }

    return this.prisma.contact.findMany({
      where,
      select: { id: true, phone: true, firstName: true },
      take:   10_000,
    });
  }

  // ── Template interpolation ─────────────────────────────────────────────────

  private interpolateTemplate(
    body: string,
    vars: Record<string, string>,
  ): string {
    return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
  }

  // ── HTTP dispatch via WhatsApp API ─────────────────────────────────────────

  private async sendMessage(phone: string, message: string): Promise<void> {
    if (!this.apiUrl) {
      // Development / no-API-key mode: just log instead of failing
      this.logger.debug(`[MOCK] → ${phone}: ${message.slice(0, 60)}…`);
      return;
    }

    const res = await fetch(`${this.apiUrl}/messages`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify({
        to:   phone,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`WhatsApp API ${res.status}: ${detail}`);
    }
  }

  // ── Worker lifecycle events ────────────────────────────────────────────────

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Campaign job completed: [${job.id}]`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `WhatsApp campaign job failed — [${job.id}]: ${err.message}`,
      err.stack,
    );
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.debug(`Campaign ${job.data.campaignId}: ${progress}% sent`);
  }
}
