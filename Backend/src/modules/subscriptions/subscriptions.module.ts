import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PaymentService } from './payment.service';

@Module({
  providers:   [SubscriptionsService, PaymentService],
  controllers: [SubscriptionsController],
  exports:     [SubscriptionsService, PaymentService],
})
export class SubscriptionsModule {}
