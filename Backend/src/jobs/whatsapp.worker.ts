import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WHATSAPP_QUEUE } from '../modules/whatsapp/whatsapp.constants';

interface SendCampaignJob {
  campaignId: string;
  tenantId:   string;
}

@Processor(WHATSAPP_QUEUE, { concurrency: 3 })
export class WhatsappWorker extends WorkerHost {
  private readonly logger = new Logger(WhatsappWorker.name);
  private readonly apiUrl: string;
  private readonly apiToken: string;

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
  ) {
    super();
    this.apiUrl   = config.get<string>('whatsapp.apiUrl', '');
    this.apiToken = config.get<string>('whatsapp.apiKey',  '');
  }

  // ─── Entry point ──────────────────────────────────────────────────────────
  async process(job: Job<SendCampaignJob>): Promise<void> {
    const { campaignId, tenantId } = job.data;
    this.logger.log(`Processing WhatsApp campaign ${campaignId}`);

    const campaign = await this.prisma.whatsappCampaign.findFirst({
      where:   { id: campaignId, tenantId },
      include: { template: true },
    });
    if (!campaign) {
      this.logger.warn(`Campaign ${campaignId} not found`);
      return;
    }

    // Mark as running
    await this.prisma.whatsappCampaign.update({
      where: { id: campaignId },
      data:  { status: 'RUNNING' },
    });

    // Build contact list from targetFilters
    const filters = (campaign.targetFilters as any) ?? {};
    const contacts = await this.prisma.contact.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(filters.contactIds && filters.contactIds.length > 0 ? {
          id: { in: filters.contactIds }
        } : {}),
        ...(filters.targetAudience === 'all-leads' ? {
          OR: [
            { leadStage: { not: null } },
            { productInterests: { some: {} } }
          ]
        } : {}),
        ...(filters.targetAudience === 'all-customers' ? {
          policies: { some: {} }
        } : {}),
        ...(filters.targetAudience === 'hot-leads' ? {
          OR: [
            { leadStage: 'HOT' },
            { tags: { has: 'hot' } }
          ]
        } : {}),
        ...(filters.tag    ? { tags:     { has: filters.tag } }    : {}),
        ...(filters.policyCategory ? {
          policies: { some: { status: 'ACTIVE' } },
        } : {}),
      },
      select: { id: true, phone: true, firstName: true },
      take: 10_000,
    });

    const wallet = await this.prisma.whatsappWallet.findFirst({ where: { tenantId } });
    const balance = Number(wallet?.balance ?? 0);
    if (balance < contacts.length) {
      await this.prisma.whatsappCampaign.update({
        where: { id: campaignId },
        data:  { status: 'FAILED' },
      });
      this.logger.error(`Insufficient wallet balance for campaign ${campaignId}`);
      return;
    }

    let sent      = 0;
    let failed    = 0;
    const costPer = 1; // 1 credit per message

    for (const contact of contacts) {
      try {
        const body = this.interpolateTemplate(campaign.template.body, { name: contact.firstName });
        await this.sendMessage(contact.phone, body);

        await this.prisma.whatsappLog.create({
          data: {
            campaignId,
            phone:   contact.phone,
            status:  'SENT',
            sentAt:  new Date(),
          },
        });
        sent++;
      } catch (err: any) {
        await this.prisma.whatsappLog.create({
          data: {
            campaignId,
            phone:  contact.phone,
            status: 'FAILED',
            error:  err?.message,
          },
        });
        failed++;
      }
    }

    // Deduct cost
    const totalCost = sent * costPer;
    if (totalCost > 0 && wallet) {
      await this.prisma.$transaction([
        this.prisma.whatsappWallet.update({
          where: { id: wallet.id },
          data:  { balance: { decrement: totalCost } },
        }),
        this.prisma.walletTransaction.create({
          data: {
            walletId:     wallet.id,
            amount:       totalCost,
            type:         'DEBIT',
            description:  `Campaign: ${campaign.name}`,
            balanceAfter: Number(wallet.balance) - totalCost,
          },
        }),
      ]);
    }

    await this.prisma.whatsappCampaign.update({
      where: { id: campaignId },
      data:  { status: failed === contacts.length ? 'FAILED' : 'COMPLETED', sentCount: sent },
    });

    this.logger.log(`Campaign ${campaignId} done — sent: ${sent}, failed: ${failed}`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private interpolateTemplate(body: string, vars: Record<string, string>): string {
    return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
  }

  private async sendMessage(phone: string, message: string): Promise<void> {
    if (!this.apiUrl) {
      this.logger.debug(`[MOCK] Sending to ${phone}: ${message.slice(0, 30)}...`);
      return;
    }
    const res = await fetch(`${this.apiUrl}/messages`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiToken}` },
      body:    JSON.stringify({ to: phone, type: 'text', text: { body: message } }),
    });
    if (!res.ok) throw new Error(`WhatsApp API error: ${res.status}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} failed: ${err.message}`);
  }
}
