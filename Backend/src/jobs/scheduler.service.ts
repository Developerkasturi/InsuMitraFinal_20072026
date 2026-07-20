// ─────────────────────────────────────────────────────────────────────────────
// Scheduler Service
//
// Seeds repeatable BullMQ jobs once on application startup.
// Each repeatable job runs on a cron schedule and triggers the appropriate
// "scan" job in its queue, which then fans out per-record notify jobs.
//
// Schedules:
//   policy-renewal  → scan-renewals   daily at 07:00 IST (01:30 UTC)
//   payment-reminder → scan-payments  daily at 08:00 IST (02:30 UTC)
//
// Jobs are idempotent: BullMQ keyed repeatable jobs won't duplicate if the
// app restarts — BullMQ detects the existing repeat entry by its key.
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  POLICY_RENEWAL_QUEUE,
  PAYMENT_REMINDER_QUEUE,
  REMINDER_QUEUE,
  PolicyRenewalJob,
  PaymentReminderJob,
  ReminderJobType,
} from './queue.constants';

@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue(POLICY_RENEWAL_QUEUE)   private readonly renewalQueue:  Queue,
    @InjectQueue(PAYMENT_REMINDER_QUEUE) private readonly paymentQueue:  Queue,
    @InjectQueue(REMINDER_QUEUE)         private readonly reminderQueue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await Promise.all([
      this.registerPolicyRenewalScan(),
      this.registerPaymentReminderScan(),
      this.registerBirthdayScan(),
      this.registerFollowUpScan(),
      this.registerHealthCheckupScan(),
      this.registerFestivalCampaignScan(),
    ]);
    this.logger.log('Repeatable background jobs registered');
  }

  // ── Policy renewal daily scan ──────────────────────────────────────────────

  private async registerPolicyRenewalScan(): Promise<void> {
    // Remove stale repeatable jobs with the same key before re-adding,
    // so cron changes take effect without a manual Redis flush.
    const existing = await this.renewalQueue.getRepeatableJobs();
    for (const j of existing) {
      if (j.name === PolicyRenewalJob.SCAN_RENEWALS) {
        await this.renewalQueue.removeRepeatableByKey(j.key);
      }
    }

    await this.renewalQueue.add(
      PolicyRenewalJob.SCAN_RENEWALS,
      {},   // data: no tenant filter → scan all
      {
        repeat: {
          // 07:00 IST = 01:30 UTC
          pattern: '30 1 * * *',
          tz:      'UTC',
        },
        // Unique key so BullMQ deduplicates across restarts
        jobId:            'repeatable:scan-renewals',
        removeOnComplete: 5,
        removeOnFail:     5,
      },
    );

    this.logger.log(
      `Registered repeatable: ${PolicyRenewalJob.SCAN_RENEWALS} → daily at 07:00 IST`,
    );
  }

  // ── Payment reminder daily scan ────────────────────────────────────────────

  private async registerPaymentReminderScan(): Promise<void> {
    const existing = await this.paymentQueue.getRepeatableJobs();
    for (const j of existing) {
      if (j.name === PaymentReminderJob.SCAN_PAYMENTS) {
        await this.paymentQueue.removeRepeatableByKey(j.key);
      }
    }

    await this.paymentQueue.add(
      PaymentReminderJob.SCAN_PAYMENTS,
      {},
      {
        repeat: {
          // 08:00 IST = 02:30 UTC
          pattern: '30 2 * * *',
          tz:      'UTC',
        },
        jobId:            'repeatable:scan-payments',
        removeOnComplete: 5,
        removeOnFail:     5,
      },
    );

    this.logger.log(
      `Registered repeatable: ${PaymentReminderJob.SCAN_PAYMENTS} → daily at 08:00 IST`,
    );
  }

  // ── Birthday daily scan ───────────────────────────────────────────────────

  private async registerBirthdayScan(): Promise<void> {
    const existing = await this.reminderQueue.getRepeatableJobs();
    for (const j of existing) {
      if (j.name === ReminderJobType.SCAN_BIRTHDAYS) {
        await this.reminderQueue.removeRepeatableByKey(j.key);
      }
    }

    await this.reminderQueue.add(
      ReminderJobType.SCAN_BIRTHDAYS,
      {},
      {
        repeat: {
          // 09:00 IST = 03:30 UTC
          pattern: '30 3 * * *',
          tz:      'UTC',
        },
        jobId:            'repeatable:scan-birthdays',
        removeOnComplete: 5,
        removeOnFail:     5,
      },
    );

    this.logger.log(
      `Registered repeatable: ${ReminderJobType.SCAN_BIRTHDAYS} → daily at 09:00 IST`,
    );
  }

  // ── Follow-up daily scan ──────────────────────────────────────────────────

  private async registerFollowUpScan(): Promise<void> {
    const existing = await this.reminderQueue.getRepeatableJobs();
    for (const j of existing) {
      if (j.name === ReminderJobType.SCAN_FOLLOW_UPS) {
        await this.reminderQueue.removeRepeatableByKey(j.key);
      }
    }

    await this.reminderQueue.add(
      ReminderJobType.SCAN_FOLLOW_UPS,
      {},
      {
        repeat: {
          // 09:30 IST = 04:00 UTC
          pattern: '0 4 * * *',
          tz:      'UTC',
        },
        jobId:            'repeatable:scan-follow-ups',
        removeOnComplete: 5,
        removeOnFail:     5,
      },
    );

    this.logger.log(
      `Registered repeatable: ${ReminderJobType.SCAN_FOLLOW_UPS} → daily at 09:30 IST`,
    );
  }

  // ── Manual trigger helpers (callable from admin endpoints if needed) ────────

  async triggerRenewalScanForTenant(tenantId: string): Promise<void> {
    await this.renewalQueue.add(
      PolicyRenewalJob.SCAN_RENEWALS,
      { tenantId },
      { removeOnComplete: 10 },
    );
    this.logger.log(`Manual renewal scan queued for tenant ${tenantId}`);
  }

  async triggerPaymentScanForTenant(tenantId: string): Promise<void> {
    await this.paymentQueue.add(
      PaymentReminderJob.SCAN_PAYMENTS,
      { tenantId },
      { removeOnComplete: 10 },
    );
    this.logger.log(`Manual payment scan queued for tenant ${tenantId}`);
  }

  private async registerHealthCheckupScan(): Promise<void> {
    const existing = await this.reminderQueue.getRepeatableJobs();
    for (const j of existing) {
      if (j.name === ReminderJobType.SCAN_HEALTH_CHECKUPS) {
        await this.reminderQueue.removeRepeatableByKey(j.key);
      }
    }

    await this.reminderQueue.add(
      ReminderJobType.SCAN_HEALTH_CHECKUPS,
      {},
      {
        repeat: {
          // 10:00 IST = 04:30 UTC
          pattern: '30 4 * * *',
          tz:      'UTC',
        },
        jobId:            'repeatable:scan-health-checkups',
        removeOnComplete: 5,
        removeOnFail:     5,
      },
    );

    this.logger.log(
      `Registered repeatable: ${ReminderJobType.SCAN_HEALTH_CHECKUPS} → daily at 10:00 IST`,
    );
  }

  private async registerFestivalCampaignScan(): Promise<void> {
    const existing = await this.reminderQueue.getRepeatableJobs();
    for (const j of existing) {
      if (j.name === ReminderJobType.SCAN_FESTIVAL_CAMPAIGNS) {
        await this.reminderQueue.removeRepeatableByKey(j.key);
      }
    }

    await this.reminderQueue.add(
      ReminderJobType.SCAN_FESTIVAL_CAMPAIGNS,
      {},
      {
        repeat: {
          // 11:00 IST = 05:30 UTC
          pattern: '0 5 * * *',
          tz:      'UTC',
        },
        jobId:            'repeatable:scan-festival-campaigns',
        removeOnComplete: 5,
        removeOnFail:     5,
      },
    );

    this.logger.log(
      `Registered repeatable: ${ReminderJobType.SCAN_FESTIVAL_CAMPAIGNS} → daily at 11:00 IST`,
    );
  }
}
