// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Service — campaigns, templates, wallet, auto-campaigns
// ─────────────────────────────────────────────────────────────────────────────
import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue }       from 'bullmq';
import { PrismaService }  from '../../database/prisma.service';
import { ConfigService }  from '@nestjs/config';
import { WHATSAPP_QUEUE } from './whatsapp.constants';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
    @InjectQueue(WHATSAPP_QUEUE) private readonly campaignQueue: Queue,
  ) {}

  // ── Templates ─────────────────────────────────────────────────────────────

  async listTemplates(tenantId: string) {
    const templates = await this.prisma.whatsappTemplate.findMany({
      where:   { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return { data: templates };
  }

  async createTemplate(tenantId: string, dto: any) {
    // Extract variable placeholders like {{name}}, {{policy_number}}
    const variables = [...(dto.body as string).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    
    const template = await this.prisma.whatsappTemplate.create({
      data: { ...dto, tenantId, variables },
    });
    return { data: template, message: 'Template created' };
  }

  async deleteTemplate(tenantId: string, id: string) {
    await this.prisma.whatsappTemplate.updateMany({
      where: { id, tenantId },
      data:  { isActive: false },
    });
    return { data: null, message: 'Template deleted' };
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────

  async listCampaigns(tenantId: string, query: any) {
    const page  = Math.max(1, parseInt(String(query.page  ?? 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? 20), 10) || 20));
    const [data, total] = await Promise.all([
      this.prisma.whatsappCampaign.findMany({
        where:   { tenantId },
        skip:    (page - 1) * limit,
        take:    limit,
        include: { template: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.whatsappCampaign.count({ where: { tenantId } }),
    ]);
    return { data, meta: { total, page, limit } };
  }

  async createCampaign(tenantId: string, dto: any) {
    const template = await this.prisma.whatsappTemplate.findFirst({
      where: { id: dto.templateId, tenantId },
    });
    if (!template) throw new NotFoundException('Template not found');

    const {
      name,
      templateId,
      scheduledAt,
      targetFilters,
      contactIds,
      frequency,
      triggerType,
      eventTrigger,
      festivalName,
      messageType,
      recurrence,
    } = dto;

    const mergedFilters = {
      ...(typeof targetFilters === 'object' ? targetFilters : {}),
      contactIds,
      frequency,
      triggerType,
      eventTrigger,
      festivalName,
      messageType,
      recurrence,
    };

    const campaign = await this.prisma.whatsappCampaign.create({
      data: {
        name,
        templateId,
        tenantId,
        status: 'DRAFT',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        targetFilters: mergedFilters,
      },
    });
    return { data: campaign, message: 'Campaign created' };
  }

  async scheduleCampaign(tenantId: string, id: string, scheduledAt: string) {
    const campaign = await this.prisma.whatsappCampaign.findFirst({ where: { id, tenantId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT campaigns can be scheduled');
    }

    const runAt = new Date(scheduledAt);

    await this.prisma.whatsappCampaign.update({
      where: { id },
      data:  { status: 'SCHEDULED', scheduledAt: runAt },
    });

    // Enqueue job with delay
    const delay = runAt.getTime() - Date.now();
    await this.campaignQueue.add(
      'send-campaign',
      { campaignId: id, tenantId },
      { delay: Math.max(delay, 0), jobId: `campaign-${id}` },
    );

    return { data: null, message: 'Campaign scheduled' };
  }

  async launchCampaignNow(tenantId: string, id: string) {
    const campaign = await this.prisma.whatsappCampaign.findFirst({ where: { id, tenantId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    await this.prisma.whatsappCampaign.update({
      where: { id },
      data:  { status: 'RUNNING', startedAt: new Date() },
    });

    await this.campaignQueue.add('send-campaign', { campaignId: id, tenantId }, { jobId: `campaign-${id}` });
    return { data: null, message: 'Campaign launched' };
  }

  // ── Wallet ────────────────────────────────────────────────────────────────

  async getWallet(tenantId: string) {
    const wallet = await this.prisma.whatsappWallet.findUnique({ where: { tenantId } });
    if (!wallet) {
      // Auto-create wallet on first access
      const created = await this.prisma.whatsappWallet.create({ data: { tenantId } });
      return { data: created };
    }
    return { data: wallet };
  }

  async topUpWallet(tenantId: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const wallet = await this.prisma.whatsappWallet.upsert({
      where:  { tenantId },
      create: { tenantId, balance: amount },
      update: { balance: { increment: amount } },
    });

    await this.prisma.walletTransaction.create({
      data: {
        walletId:    wallet.id,
        type:        'CREDIT',
        amount,
        balanceAfter: wallet.balance,
        description: 'Manual top-up',
      },
    });

    return { data: wallet, message: `₹${amount} added to WhatsApp wallet` };
  }

  async getTransactions(tenantId: string, query: any) {
    const wallet = await this.prisma.whatsappWallet.findUnique({ where: { tenantId } });
    if (!wallet) return { data: [] };

    const txns = await this.prisma.walletTransaction.findMany({
      where:   { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });
    return { data: txns };
  }

  // ── Campaign logs ──────────────────────────────────────────────────────────

  async getCampaignLogs(tenantId: string, campaignId: string) {
    await this.prisma.whatsappCampaign.findFirstOrThrow({ where: { id: campaignId, tenantId } });
    const logs = await this.prisma.whatsappLog.findMany({
      where:   { campaignId },
      orderBy: { createdAt: 'desc' },
      take:    200,
    });
    return { data: logs };
  }

  private async sendMessage(phone: string, message: string): Promise<void> {
    const apiUrl = this.config.get<string>('whatsapp.apiUrl', '');
    const apiToken = this.config.get<string>('whatsapp.apiKey', '');

    if (!apiUrl) {
      this.logger.log(`[MOCK] Event msg → ${phone}: ${message}`);
      return;
    }

    const res = await fetch(`${apiUrl}/messages`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiToken}`,
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

  async triggerEventCampaign(
    tenantId: string,
    eventTrigger: string,
    contactId: string,
    variables: Record<string, string>,
    additionalFilters?: Record<string, any>,
  ): Promise<void> {
    const campaigns = await this.prisma.whatsappCampaign.findMany({
      where: {
        tenantId,
        status: { in: ['DRAFT', 'SCHEDULED', 'RUNNING'] },
      },
      include: { template: true },
    });

    const activeCampaigns = campaigns.filter((c: any) => {
      const filters = c.targetFilters || {};
      if (filters.triggerType !== 'event') return false;
      if (filters.eventTrigger !== eventTrigger) return false;
      if (additionalFilters) {
        for (const [k, v] of Object.entries(additionalFilters)) {
          if (filters[k] !== v) return false;
        }
      }
      return true;
    });

    if (activeCampaigns.length === 0) return;

    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId, isActive: true },
    });
    if (!contact) return;

    const wallet = await this.prisma.whatsappWallet.findFirst({ where: { tenantId } });
    if (!wallet) return;
    const balance = Number(wallet.balance ?? 0);
    const costPer = 1;

    for (const campaign of activeCampaigns as any[]) {
      if (balance < costPer) {
        this.logger.warn(`Insufficient balance for event campaign ${campaign.id}`);
        continue;
      }

      let body = campaign.template.body;
      const contactVars = {
        name: `${contact.firstName} ${contact.lastName}`,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
        ...variables,
      };

      body = body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return contactVars[key as keyof typeof contactVars] ?? `{{${key}}}`;
      });

      try {
        await this.sendMessage(contact.phone, body);

        await this.prisma.$transaction([
          this.prisma.whatsappWallet.update({
            where: { id: wallet.id },
            data:  { balance: { decrement: costPer } },
          }),
          this.prisma.walletTransaction.create({
            data: {
              walletId:     wallet.id,
              amount:       costPer,
              type:         'DEBIT',
              description:  `Event Campaign: ${campaign.name} (${eventTrigger})`,
              balanceAfter: balance - costPer,
            },
          }),
          this.prisma.whatsappLog.create({
            data: {
              campaignId: campaign.id,
              phone:      contact.phone,
              status:     'DELIVERED',
              sentAt:     new Date(),
            },
          }),
          this.prisma.whatsappCampaign.update({
            where: { id: campaign.id },
            data: {
              sentCount: { increment: 1 },
              totalCount: { increment: 1 },
            },
          }),
        ]);
      } catch (err: any) {
        await this.prisma.whatsappLog.create({
          data: {
            campaignId: campaign.id,
            phone:      contact.phone,
            status:     'FAILED',
            error:      err?.message,
          },
        });
      }
    }
  }
}
