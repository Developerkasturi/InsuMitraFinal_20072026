// ─────────────────────────────────────────────────────────────────────────────
// Policy Renewal Worker
//
// Queue : policy-renewal
// Concurrency : 5
//
// Jobs handled:
//   scan-renewals  — Repeatable daily job.  Scans ALL tenants for policies
//                    expiring within configurable windows (30 / 14 / 7 / 1 days)
//                    and enqueues a `notify-renewal` job for each matching policy.
//
//   notify-renewal — Point-in-time job per policy.  Loads the policy + contact,
//                    creates an in-app Notification for the assigned employee,
//                    writes an ActivityLog entry, and optionally updates a
//                    `lastRenewalReminderAt` field so duplicates are avoided.
// ─────────────────────────────────────────────────────────────────────────────

import { OnWorkerEvent, Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue as InjectBullQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService }    from '../database/prisma.service';
import { NotificationType } from '@prisma/client';
import {
  POLICY_RENEWAL_QUEUE,
  PolicyRenewalJob,
} from './queue.constants';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from '../modules/whatsapp/whatsapp.service';

// Days before expiry at which we send reminders
const RENEWAL_WINDOWS = [45, 30, 15, 7, 3] as const;

interface ScanRenewalsJobData {
  /** Optional: restrict scan to a single tenant (used for manual triggers) */
  tenantId?: string;
}

interface NotifyRenewalJobData {
  policyId: string;
  tenantId: string;
  daysLeft: number;
}

@Processor(POLICY_RENEWAL_QUEUE, { concurrency: 5 })
export class PolicyRenewalWorker extends WorkerHost {
  private readonly logger = new Logger(PolicyRenewalWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectBullQueue(POLICY_RENEWAL_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  // ── Entry point ────────────────────────────────────────────────────────────

  async process(job: Job<ScanRenewalsJobData | NotifyRenewalJobData>): Promise<void> {
    switch (job.name as PolicyRenewalJob) {
      case PolicyRenewalJob.SCAN_RENEWALS:
        return this.scanRenewals(job as Job<ScanRenewalsJobData>);
      case PolicyRenewalJob.NOTIFY_RENEWAL:
        return this.notifyRenewal(job as Job<NotifyRenewalJobData>);
      default:
        this.logger.warn(`Unknown policy-renewal job: "${job.name}"`);
    }
  }

  // ── Scan: find all expiring policies and enqueue notify jobs ───────────────

  private async scanRenewals(job: Job<ScanRenewalsJobData>): Promise<void> {
    const { tenantId } = job.data;
    const now = new Date();

    // Build expiry windows: policies whose endDate falls within each window
    const windowFilters = RENEWAL_WINDOWS.map((days) => {
      const from = new Date(now);
      const to   = new Date(now);
      from.setDate(from.getDate() + days - 1);
      to.setDate(to.getDate() + days);
      return { gte: from, lt: to };
    });

    for (const dateRange of windowFilters) {
      const policies = await this.prisma.policy.findMany({
        where: {
          ...(tenantId ? { tenantId } : {}),
          status:  'ACTIVE',
          endDate: dateRange,
          assignedEmployeeId: { not: null },
        },
        select: {
          id:       true,
          tenantId: true,
          endDate:  true,
        },
      });

      if (policies.length === 0) continue;

      const daysLeft = Math.round(
        (new Date(dateRange.gte).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;

      await this.queue.addBulk(
        policies.map((p) => ({
          name: PolicyRenewalJob.NOTIFY_RENEWAL,
          data: { policyId: p.id, tenantId: p.tenantId, daysLeft } satisfies NotifyRenewalJobData,
          opts: {
            // Deduplicate: one notification per policy per day
            jobId:          `renewal-${p.id}-${daysLeft}d-${now.toISOString().slice(0, 10)}`,
            removeOnComplete: 200,
            removeOnFail:     50,
          },
        })),
      );

      this.logger.log(
        `Enqueued ${policies.length} renewal notify jobs (${daysLeft} days window)`,
      );
    }
  }

  // ── Notify: send in-app notification + log activity ────────────────────────

  private async notifyRenewal(job: Job<NotifyRenewalJobData>): Promise<void> {
    const { policyId, tenantId, daysLeft } = job.data;

    const policy = await this.prisma.policy.findFirst({
      where:   { id: policyId, tenantId, status: 'ACTIVE' },
      include: {
        contact:          { select: { firstName: true, lastName: true, phone: true } },
        plan:             { include: { company: { select: { name: true } } } },
        assignedEmployee: { select: { id: true } },
      },
    });

    if (!policy || !policy.assignedEmployeeId) {
      this.logger.debug(`Policy ${policyId} not found or has no assigned employee — skipping`);
      return;
    }

    const contactName = `${policy.contact.firstName} ${policy.contact.lastName}`;
    const planName    = policy.plan?.name ?? 'Unknown Plan';
    const company     = policy.plan?.company?.name ?? '';
    const expiryDate  = policy.endDate.toLocaleDateString('en-IN');
    const urgency     = daysLeft <= 7 ? '⚠️ URGENT — ' : '';

    await this.prisma.$transaction([
      // In-app notification for the assigned employee
      this.prisma.notification.create({
        data: {
          tenantId,
          userId: policy.assignedEmployeeId,
          type:   NotificationType.RENEWAL_REMINDER,
          title:  `${urgency}Policy Renewal in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          body:   `${contactName}'s ${planName}${company ? ` (${company})` : ''} policy ${policy.policyNumber} expires on ${expiryDate}.`,
          data:   { link: `/policies/${policyId}`, policyId, daysLeft },
        },
      }),
      // Audit trail
      this.prisma.activityLog.create({
        data: {
          tenantId,
          userId:      policy.assignedEmployeeId,
          contactId:   policy.contactId,
          entityType:  'Policy',
          entityId:    policyId,
          action:      'RENEWAL_REMINDER',
          description: `Renewal reminder sent — ${daysLeft} day(s) to expiry`,
        },
      }),
    ]);

    this.logger.log(
      `Renewal reminder sent — policy ${policy.policyNumber} (${daysLeft}d left)`,
    );

    // Trigger event-based WhatsApp campaign
    try {
      const whatsappService = new WhatsappService(this.prisma, new ConfigService(), null as any);
      await whatsappService.triggerEventCampaign(tenantId, 'renewal', policy.contactId, {
        policyNumber: policy.policyNumber,
        planName,
        expiryDate,
        daysLeft: String(daysLeft),
      });
    } catch (err: any) {
      this.logger.error(`Failed to trigger renewal WhatsApp campaign: ${err.message}`);
    }
  }

  // ── Worker lifecycle events ────────────────────────────────────────────────

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Job completed: ${job.name} [${job.id}]`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Policy renewal job failed — ${job.name} [${job.id}]: ${err.message}`,
      err.stack,
    );
  }
}
