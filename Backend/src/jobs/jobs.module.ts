import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import {
  POLICY_RENEWAL_QUEUE,
  PAYMENT_REMINDER_QUEUE,
  WHATSAPP_CAMPAIGN_QUEUE,
  REMINDER_QUEUE,
} from './queue.constants';

import { PolicyRenewalWorker }    from './policy-renewal.worker';
import { PaymentReminderWorker }  from './payment-reminder.worker';
import { WhatsappWorker }         from './whatsapp.worker';
import { WhatsappCampaignWorker } from './whatsapp-campaign.worker';
import { ReminderWorker }         from './reminder.worker';    // birthday & follow-up
import { SchedulerService }       from './scheduler.service';

@Module({
  imports: [
    // One BullModule.registerQueue entry per named queue
    BullModule.registerQueue({ name: POLICY_RENEWAL_QUEUE }),
    BullModule.registerQueue({ name: PAYMENT_REMINDER_QUEUE }),
    BullModule.registerQueue({ name: WHATSAPP_CAMPAIGN_QUEUE }),
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
  ],
  providers: [
    // Dedicated workers
    PolicyRenewalWorker,
    PaymentReminderWorker,
    WhatsappWorker,
    WhatsappCampaignWorker,
    // Legacy combined worker (birthday wishes, follow-up reminders)
    ReminderWorker,
    // Registers repeatable cron jobs on startup
    SchedulerService,
  ],
  exports: [SchedulerService],
})
export class JobsModule {}
