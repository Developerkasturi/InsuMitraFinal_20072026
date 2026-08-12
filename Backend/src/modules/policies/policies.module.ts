import { Module } from '@nestjs/common';
import { PoliciesController } from './policies.controller';
import { PoliciesService }    from './policies.service';
import { LeadsModule }        from '../leads/leads.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [LeadsModule, NotificationsModule],
  controllers: [PoliciesController],
  providers:   [PoliciesService],
  exports:     [PoliciesService],
})
export class PoliciesModule {}
