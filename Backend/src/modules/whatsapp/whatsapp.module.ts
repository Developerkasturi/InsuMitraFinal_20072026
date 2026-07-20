import { Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService }    from './whatsapp.service';
import { WHATSAPP_QUEUE }     from './whatsapp.constants';
import { isRedisEnabled }     from '../../common/redis/redis-enabled';

import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

const redisEnabled = isRedisEnabled();
const disabledQueue = {
  add: async () => null,
};

@Module({
  imports: [
    SubscriptionsModule,
    ...(redisEnabled ? [
      BullModule.registerQueue({ name: WHATSAPP_QUEUE }),
    ] : []),
  ],
  controllers: [WhatsappController],
  providers:   [
    WhatsappService,
    ...(redisEnabled ? [] : [{
      provide: getQueueToken(WHATSAPP_QUEUE),
      useValue: disabledQueue,
    }]),
  ],
  exports:     [WhatsappService],
})
export class WhatsappModule {}
