import { Module } from '@nestjs/common';
import { AgencyDetailsService } from './agency-details.service';
import { AgencyDetailsController } from './agency-details.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AgencyDetailsController],
  providers: [AgencyDetailsService],
})
export class AgencyDetailsModule {}
