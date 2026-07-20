// ─────────────────────────────────────────────────────────────────────────────
// Payment Reminder Worker
//
// Queue : payment-reminder
// Concurrency : 5
//
// Jobs handled:
//   scan-payments  — Repeatable daily job.  Scans ALL tenants for unpaid policy
//                    premiums whose dueDate falls within the next 7 or 30 days,
//                    and enqueues a `notify-payment` job for each.
//
//   notify-payment — Point-in-time job per payment record.  Sends an in-app
//                    Notification to the assigned employee and writes an
//                    ActivityLog entry for the audit trail.
// ─────────────────────────────────────────────────────────────────────────────

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService }    from '../database/prisma.service';
import { NotificationType } from '@prisma/client';
import {
  PAYMENT_REMINDER_QUEUE,
  PaymentReminderJob,
} from './queue.constants';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from '../modules/whatsapp/whatsapp.service';

// Days before due date at which to send reminders
const PAYMENT_WINDOWS = [30, 7] as const;

interface ScanPaymentsJobData {
  /** Optional: restrict scan to a single tenant */
  tenantId?: string;
}

interface NotifyPaymentJobData {
  paymentId: string;
  tenantId:  string;
  daysLeft:  number;
}

@Processor(PAYMENT_REMINDER_QUEUE, { concurrency: 5 })
export class PaymentReminderWorker extends WorkerHost {
  private readonly logger = new Logger(PaymentReminderWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PAYMENT_REMINDER_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  // ── Entry point ────────────────────────────────────────────────────────────

  async process(job: Job<ScanPaymentsJobData | NotifyPaymentJobData>): Promise<void> {
    switch (job.name as PaymentReminderJob) {
      case PaymentReminderJob.SCAN_PAYMENTS:
        return this.scanPayments(job as Job<ScanPaymentsJobData>);
      case PaymentReminderJob.NOTIFY_PAYMENT:
        return this.notifyPayment(job as Job<NotifyPaymentJobData>);
      default:
        this.logger.warn(`Unknown payment-reminder job: "${job.name}"`);
    }
  }

  // ── Scan: find all upcoming unpaid premiums ────────────────────────────────

  private async scanPayments(job: Job<ScanPaymentsJobData>): Promise<void> {
    const { tenantId } = job.data;
    const now = new Date();

    // 1st and 3rd of month installment triggers
    const currentDay = now.getDate();
    if (currentDay === 1 || currentDay === 3) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthPayments = await this.prisma.policyPayment.findMany({
        where: {
          isPaid:  false,
          dueDate: { gte: startOfMonth, lte: endOfMonth },
          policy: {
            ...(tenantId ? { tenantId } : {}),
            status:             'ACTIVE',
            assignedEmployeeId: { not: null },
          },
        },
        select: {
          id:     true,
          policy: { select: { tenantId: true } },
        },
      });

      if (monthPayments.length > 0) {
        const todayStr = now.toISOString().slice(0, 10);
        await this.queue.addBulk(
          monthPayments.map((p) => ({
            name: PaymentReminderJob.NOTIFY_PAYMENT,
            data: {
              paymentId: p.id,
              tenantId:  p.policy.tenantId,
              daysLeft:  0,
            } satisfies NotifyPaymentJobData,
            opts: {
              jobId:            `payment-monthly-trigger-${p.id}-${currentDay}-${todayStr}`,
              removeOnComplete: 200,
              removeOnFail:     50,
            },
          })),
        );
        this.logger.log(`Enqueued ${monthPayments.length} monthly installment reminders (Day ${currentDay})`);
      }
    }

    for (const days of PAYMENT_WINDOWS) {
      const from = new Date(now);
      const to   = new Date(now);
      from.setDate(from.getDate() + days - 1);
      to.setDate(to.getDate() + days);

      const payments = await this.prisma.policyPayment.findMany({
        where: {
          isPaid:  false,
          dueDate: { gte: from, lt: to },
          policy: {
            ...(tenantId ? { tenantId } : {}),
            status:             'ACTIVE',
            assignedEmployeeId: { not: null },
          },
        },
        select: {
          id:     true,
          policy: { select: { tenantId: true } },
        },
      });

      if (payments.length === 0) continue;

      const todayStr = now.toISOString().slice(0, 10);

      await this.queue.addBulk(
        payments.map((p) => ({
          name: PaymentReminderJob.NOTIFY_PAYMENT,
          data: {
            paymentId: p.id,
            tenantId:  p.policy.tenantId,
            daysLeft:  days,
          } satisfies NotifyPaymentJobData,
          opts: {
            // Deduplicate: one reminder per payment per day
            jobId:            `payment-${p.id}-${days}d-${todayStr}`,
            removeOnComplete: 200,
            removeOnFail:     50,
          },
        })),
      );

      this.logger.log(
        `Enqueued ${payments.length} payment reminder jobs (${days}-day window)`,
      );
    }
  }

  // ── Notify: send in-app notification + audit log ───────────────────────────

  private async notifyPayment(job: Job<NotifyPaymentJobData>): Promise<void> {
    const { paymentId, tenantId, daysLeft } = job.data;

    const payment = await this.prisma.policyPayment.findFirst({
      where: { id: paymentId, isPaid: false },
      include: {
        policy: {
          include: {
            contact:          { select: { firstName: true, lastName: true } },
            assignedEmployee: { select: { id: true } },
          },
        },
      },
    });

    if (!payment) {
      // Payment was already marked paid or deleted
      this.logger.debug(`Payment ${paymentId} not found or already paid — skipping`);
      return;
    }

    if (!payment.policy.assignedEmployeeId) {
      this.logger.debug(`Policy has no assigned employee — skipping payment ${paymentId}`);
      return;
    }

    // Verify tenant match (safety check — data from scan is already scoped)
    if (payment.policy.tenantId !== tenantId) {
      this.logger.warn(`Tenant mismatch for payment ${paymentId} — skipping`);
      return;
    }

    const contactName = `${payment.policy.contact.firstName} ${payment.policy.contact.lastName}`;
    const policyNum   = payment.policy.policyNumber;
    const dueDate     = payment.dueDate.toLocaleDateString('en-IN');
    const amount      = Number(payment.amount).toLocaleString('en-IN', {
      maximumFractionDigits: 0,
    });
    const urgency = daysLeft <= 7 ? '⚠️ ' : '';

    await this.prisma.$transaction([
      // In-app notification for assigned employee
      this.prisma.notification.create({
        data: {
          tenantId,
          userId: payment.policy.assignedEmployeeId,
          type:   NotificationType.PAYMENT_DUE,
          title:  `${urgency}Premium Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          body:   `₹${amount} premium for ${contactName}'s policy ${policyNum} is due on ${dueDate}.`,
          data:   {
            link:      `/policies/${payment.policyId}`,
            paymentId,
            policyId:  payment.policyId,
            daysLeft,
          },
        },
      }),
      // Audit trail
      this.prisma.activityLog.create({
        data: {
          tenantId,
          userId:      payment.policy.assignedEmployeeId,
          contactId:   payment.policy.contactId,
          entityType:  'PolicyPayment',
          entityId:    paymentId,
          action:      'PAYMENT_REMINDER',
          description: `Payment reminder sent — ₹${amount} due in ${daysLeft} day(s)`,
        },
      }),
    ]);

    this.logger.log(
      `Payment reminder sent — payment ${paymentId}, policy ${policyNum} (${daysLeft}d left)`,
    );

    // Trigger event-based WhatsApp campaign
    try {
      const whatsappService = new WhatsappService(this.prisma, new ConfigService(), null as any);
      await whatsappService.triggerEventCampaign(tenantId, 'installment', payment.policy.contactId, {
        policyNumber: policyNum,
        amount,
        dueDate,
        daysLeft: String(daysLeft),
      });
    } catch (err: any) {
      this.logger.error(`Failed to trigger installment WhatsApp campaign: ${err.message}`);
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
      `Payment reminder job failed — ${job.name} [${job.id}]: ${err.message}`,
      err.stack,
    );
  }
}
