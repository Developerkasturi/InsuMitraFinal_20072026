import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CommissionsService }        from './commissions.service';
import { CreateCommissionDto, UpdateCommissionDto, CreateCommissionYearDto } from './dto/commission.dto';
import { JwtAuthGuard }        from '../auth/guards/jwt-auth.guard';
import { RbacGuard }           from '../../common/guards/rbac.guard';
import { Roles, CurrentUser }  from '../../common/decorators/roles.decorator';
import { SubscriptionGuard, RequireFeature } from '../../common/guards/subscription.guard';

@ApiTags('Commissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard, SubscriptionGuard)
@RequireFeature('commissions')
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly svc: CommissionsService) {}

  @Get('years')
  @Roles(UserRole.EMPLOYEE)
  listYears(@CurrentUser() user: any) {
    return this.svc.listYears(user.tenantId);
  }

  @Post('years')
  @Roles(UserRole.OWNER)
  createYear(@CurrentUser() user: any, @Body() dto: CreateCommissionYearDto) {
    return this.svc.createYear(user.tenantId, dto);
  }

  @Get()
  @Roles(UserRole.EMPLOYEE)
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.svc.findAll(user.tenantId, user.id, user.role, query);
  }

  @Get('overview')
  @Roles(UserRole.EMPLOYEE)
  overview(@CurrentUser() user: any) {
    return this.svc.getOverview(user.tenantId, user.id, user.role);
  }

  @Get('summary/:yearId')
  @Roles(UserRole.OWNER)
  summary(@CurrentUser() user: any, @Param('yearId') yearId: string) {
    return this.svc.getBySummary(user.tenantId, yearId);
  }

  @Post()
  @Roles(UserRole.OWNER)
  create(@CurrentUser() user: any, @Body() dto: CreateCommissionDto) {
    return this.svc.create(user.tenantId, dto);
  }

  @Patch(':id/pay')
  @Roles(UserRole.OWNER)
  markPaid(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.markPaid(user.tenantId, id);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.remove(user.tenantId, id);
  }
}
