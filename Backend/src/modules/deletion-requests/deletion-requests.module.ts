import { Module } from '@nestjs/common';
import { DeletionRequestsController } from './deletion-requests.controller';
import { DeletionRequestsService } from './deletion-requests.service';

@Module({
  controllers: [DeletionRequestsController],
  providers: [DeletionRequestsService],
  exports: [DeletionRequestsService],
})
export class DeletionRequestsModule {}
