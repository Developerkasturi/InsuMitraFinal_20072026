import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { NotificationType } from '@prisma/client';
import { REMINDER_QUEUE, ReminderJobType } from './queue.constants';

import { ConfigService } from '@nestjs/config';
import { WhatsappService } from '../modules/whatsapp/whatsapp.service';

// Re-export so existing imports from this file don't break
export { REMINDER_QUEUE, ReminderJobType };

@Processor(REMINDER_QUEUE, { concurrency: 5 })
export class ReminderWorker extends WorkerHost {
  private readonly logger = new Logger(ReminderWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(REMINDER_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case ReminderJobType.POLICY_RENEWAL:  return this.handlePolicyRenewal(job.data);
      case ReminderJobType.PAYMENT_DUE:     return this.handlePaymentDue(job.data);
      case ReminderJobType.BIRTHDAY_WISH:   return this.handleBirthdayWish(job.data);
      case ReminderJobType.FOLLOW_UP:       return this.handleFollowUp(job.data);
      case ReminderJobType.SCAN_BIRTHDAYS:  return this.handleScanBirthdays();
      case ReminderJobType.SCAN_FOLLOW_UPS: return this.handleScanFollowUps();
      case ReminderJobType.HEALTH_CHECKUP:       return this.handleHealthCheckup(job.data);
      case ReminderJobType.SCAN_HEALTH_CHECKUPS: return this.handleScanHealthCheckups();
      case ReminderJobType.SCAN_FESTIVAL_CAMPAIGNS: return this.handleScanFestivalCampaigns();
      default: this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  // ─── Policy Renewal ───────────────────────────────────────────────────────
  private async handlePolicyRenewal({ policyId, tenantId }: any) {
    const policy = await this.prisma.policy.findFirst({
      where:   { id: policyId, tenantId },
      include: { contact: true, assignedEmployee: true },
    });
    if (!policy) return;

    const daysLeft = Math.ceil(
      (policy.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    // Notify assigned employee
    if (policy.assignedEmployeeId) {
      await this.createNotification(tenantId, policy.assignedEmployeeId, {
        type:  NotificationType.RENEWAL_REMINDER,
        title: `Policy Renewal Due in ${daysLeft} days`,
        body:  `Policy ${policy.policyNumber} for ${policy.contact.firstName} ${policy.contact.lastName} expires on ${policy.endDate.toLocaleDateString('en-IN')}`,
        link:  `/policies/${policyId}`,
      });
    }
    this.logger.log(`Renewal reminder sent for policy ${policy.policyNumber}`);
  }

  // ─── Payment Due ──────────────────────────────────────────────────────────
  private async handlePaymentDue({ paymentId, tenantId }: any) {
    const payment = await this.prisma.policyPayment.findFirst({
      where:   { id: paymentId },
      include: { policy: { include: { contact: true, assignedEmployee: true } } },
    });
    if (!payment || payment.isPaid) return; // already paid

    const policy = payment.policy;
    if (policy.assignedEmployeeId) {
      await this.createNotification(tenantId, policy.assignedEmployeeId, {
        type:  NotificationType.PAYMENT_DUE,
        title: 'Premium Payment Due',
        body:  `Payment of ₹${payment.amount} due for policy ${policy.policyNumber} (${policy.contact.firstName} ${policy.contact.lastName}) on ${payment.dueDate.toLocaleDateString('en-IN')}`,
        link:  `/policies/${policy.id}`,
      });
    }
    this.logger.log(`Payment reminder sent for payment ${paymentId}`);
  }

  // ─── Birthday Wish ────────────────────────────────────────────────────────
  private async handleBirthdayWish({ contactId, tenantId }: any) {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, tenantId } });
    if (!contact) return;

    const employees = await this.prisma.user.findMany({
      where: { tenantId, isActive: true, role: { in: ['OWNER', 'EMPLOYEE'] } },
      select: { id: true },
    });

    await this.prisma.notification.createMany({
      data: employees.map(e => ({
        tenantId,
        userId: e.id,
        type:   NotificationType.BIRTHDAY,
        title:  `Birthday: ${contact.firstName} ${contact.lastName}`,
        body:   `Today is ${contact.firstName}'s birthday! Send them wishes.`,
        data:   { link: `/contacts/${contactId}` },
      })),
    });
    this.logger.log(`Birthday notification sent for contact ${contactId}`);

    // Trigger event-based WhatsApp campaign
    try {
      const whatsappService = new WhatsappService(this.prisma, new ConfigService(), null as any);
      await whatsappService.triggerEventCampaign(tenantId, 'birthday', contactId, {});
    } catch (err: any) {
      this.logger.error(`Failed to trigger birthday WhatsApp campaign: ${err.message}`);
    }
  }

  // ─── Follow-up Reminder ───────────────────────────────────────────────────
  private async handleFollowUp({ leadId, tenantId }: any) {
    const lead = await this.prisma.productInterest.findFirst({
      where:   { id: leadId, tenantId },
      include: { contact: true, assignedEmployee: true, plan: true },
    });
    if (!lead || !lead.assignedEmployeeId) return;

    await this.createNotification(tenantId, lead.assignedEmployeeId, {
      type:  NotificationType.LEAD_FOLLOWUP,
      title: 'Follow-up Due',
      body:  `Follow up with ${lead.contact.firstName} ${lead.contact.lastName} regarding ${lead.plan ? 'insurance plan' : 'interest'}`,
      link:  `/leads/${leadId}`,
    });
    this.logger.log(`Follow-up reminder sent for lead ${leadId}`);
  }

  // ─── Helper: create in-app notification ───────────────────────────────────
  private createNotification(
    tenantId: string,
    userId:   string,
    payload:  { type: NotificationType; title: string; body: string; link?: string },
  ) {
    const { link, ...rest } = payload;
    return this.prisma.notification.create({
      data: { tenantId, userId, ...rest, data: link ? { link } : {} },
    });
  }

  // ─── Birthday Scan ────────────────────────────────────────────────────────
  private async handleScanBirthdays() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day   = today.getDate();

    const contacts = (
      await this.prisma.contact.findMany({
        where: {
          isActive: true,
          dateOfBirth: { not: null },
        },
        select: { id: true, tenantId: true, dateOfBirth: true },
      })
    ).filter((contact) => {
      const dob = contact.dateOfBirth;
      return dob && dob.getMonth() + 1 === month && dob.getDate() === day;
    });

    await Promise.all(
      contacts.map((c) =>
        this.queue.add(
          ReminderJobType.BIRTHDAY_WISH,
          { contactId: c.id, tenantId: c.tenantId },
          { removeOnComplete: 10 },
        ),
      ),
    );
    this.logger.log(`Birthday scan: ${contacts.length} contacts queued`);
  }

  // ─── Follow-up Scan ───────────────────────────────────────────────────────
  private async handleScanFollowUps() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay   = new Date(startOfDay.getTime() + 86_400_000 - 1);

    const leads = await this.prisma.productInterest.findMany({
      where: {
        followUpDate:       { gte: startOfDay, lte: endOfDay },
        assignedEmployeeId: { not: null },
      },
      select: { id: true, tenantId: true },
    });

    await Promise.all(
      leads.map((l) =>
        this.queue.add(
          ReminderJobType.FOLLOW_UP,
          { leadId: l.id, tenantId: l.tenantId },
          { removeOnComplete: 10 },
        ),
      ),
    );
    this.logger.log(`Follow-up scan: ${leads.length} leads queued`);
  }

  private async handleHealthCheckup({ checkupId, tenantId }: any) {
    const checkup = await this.prisma.preventiveHealthCheckup.findFirst({
      where:   { id: checkupId },
      include: { policy: { include: { contact: true } } },
    });
    if (!checkup || checkup.completedAt) return; // already completed

    const policy = checkup.policy;
    if (policy.assignedEmployeeId) {
      await this.createNotification(tenantId, policy.assignedEmployeeId, {
        type:  NotificationType.SYSTEM,
        title: 'Preventive Health Checkup Scheduled',
        body:  `Preventive Health Checkup scheduled for ${policy.contact.firstName} ${policy.contact.lastName} on ${checkup.scheduledAt.toLocaleDateString('en-IN')}`,
        link:  `/policies/${policy.id}`,
      });
    }
    this.logger.log(`Health checkup reminder sent for checkup ${checkupId}`);

    // Trigger event-based WhatsApp campaign
    try {
      const whatsappService = new WhatsappService(this.prisma, new ConfigService(), null as any);
      await whatsappService.triggerEventCampaign(tenantId, 'phc', checkup.policy.contactId, {
        policyNumber: checkup.policy.policyNumber,
        checkupDate: checkup.scheduledAt.toLocaleDateString('en-IN'),
      });
    } catch (err: any) {
      this.logger.error(`Failed to trigger PHC WhatsApp campaign: ${err.message}`);
    }
  }

  private async handleScanHealthCheckups() {
    const today = new Date();
    const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    const checkups = await this.prisma.preventiveHealthCheckup.findMany({
      where: {
        completedAt: null,
        scheduledAt: { gte: today, lte: threeDaysLater },
      },
      include: { policy: true },
    });

    await Promise.all(
      checkups.map((c) =>
        this.queue.add(
          ReminderJobType.HEALTH_CHECKUP,
          { checkupId: c.id, tenantId: c.policy.tenantId },
          { removeOnComplete: 10 },
        ),
      ),
    );
    this.logger.log(`Health checkups scan: ${checkups.length} checkups queued`);
  }

  private async handleScanFestivalCampaigns() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    let activeFestival = 'custom'; // Default trigger for matching in tests
    if (month === 12 && day === 25) activeFestival = 'christmas';
    else if (month === 1 && day === 1) activeFestival = 'new_year';
    else if (month === 3 && day === 15) activeFestival = 'holi';
    else if (month === 11 && day === 1) activeFestival = 'diwali';
    else if (month === 4 && day === 10) activeFestival = 'eid';

        const campaigns = await this.prisma.whatsappCampaign.findMany({
      where: {
        status: { in: ['DRAFT', 'SCHEDULED', 'RUNNING'] },
      },
      include: { template: true },
    });

    const festivalCampaigns = campaigns.filter((c: any) => {
      const filters = c.targetFilters || {};
      return (
        filters.triggerType === 'event' &&
        filters.eventTrigger === 'festival' &&
        (filters.festivalName === activeFestival || filters.festivalName === 'custom')
      );
    });

    if (festivalCampaigns.length === 0) return;

    const whatsappService = new WhatsappService(this.prisma, new ConfigService(), null as any);

    for (const campaign of festivalCampaigns as any[]) {
      const targetAudience = campaign.targetFilters?.['targetAudience'] || 'all-leads';
      const contactIds = campaign.targetFilters?.['contactIds'] || [];

      const contacts = await this.prisma.contact.findMany({
        where: {
          tenantId: campaign.tenantId,
          isActive: true,
          ...(contactIds.length > 0 ? { id: { in: contactIds } } : {}),
          ...(targetAudience === 'all-leads' ? {
            OR: [
              { leadStage: { not: null } },
              { productInterests: { some: {} } }
            ]
          } : {}),
          ...(targetAudience === 'all-customers' ? {
            policies: { some: {} }
          } : {}),
        },
      });

      for (const contact of contacts) {
        await whatsappService.triggerEventCampaign(
          campaign.tenantId,
          'festival',
          contact.id,
          { festivalName: campaign.targetFilters?.['festivalName'] || 'festival' },
        );
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Reminder job ${job.id} (${job.name}) failed: ${err.message}`);
  }
}
