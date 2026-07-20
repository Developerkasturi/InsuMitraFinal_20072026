import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { SubscriptionGuard, RequireFeature } from '../../common/guards/subscription.guard';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard, SubscriptionGuard)
@Roles(UserRole.OWNER)
@RequireFeature('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get('kpis')
  kpis(@Req() req: any) {
    return this.svc.getKpis(req.tenantId);
  }

  @Get('db-summary')
  dbSummary(@Req() req: any) {
    return this.svc.getDbSummary(req.tenantId);
  }

  @Get('revenue')
  @ApiQuery({ name: 'months', required: false })
  revenue(@Req() req: any, @Query('months') months?: string) {
    return this.svc.getMonthlyRevenue(req.tenantId, months ? parseInt(months) : 12);
  }

  @Get('portfolio')
  portfolio(@Req() req: any) {
    return this.svc.getPolicyPortfolio(req.tenantId);
  }

  @Get('pipeline')
  pipeline(@Req() req: any) {
    return this.svc.getLeadPipeline(req.tenantId);
  }

  @Get('events')
  events(@Req() req: any) {
    return this.svc.getUpcomingEvents(req.tenantId);
  }

  @Get('claims')
  claims(@Req() req: any) {
    return this.svc.getClaimSummary(req.tenantId);
  }
}
