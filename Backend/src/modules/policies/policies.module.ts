import { Module } from '@nestjs/common';
import { PoliciesController } from './policies.controller';
import { PoliciesService }    from './policies.service';
import { LeadsModule }        from '../leads/leads.module';

@Module({
  imports:     [LeadsModule],
  controllers: [PoliciesController],
  providers:   [PoliciesService],
  exports:     [PoliciesService],
})
export class PoliciesModule {}
