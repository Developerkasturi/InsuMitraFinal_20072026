import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard';
import { RbacGuard }     from '../../common/guards/rbac.guard';
import { Roles }         from '../../common/decorators/roles.decorator';
import { UserRole }      from '@prisma/client';
import { InsuranceService } from './insurance.service';
import { SubscriptionGuard, RequireFeature } from '../../common/guards/subscription.guard';

@ApiTags('Insurance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard, SubscriptionGuard)
@RequireFeature('operations')
@Controller('insurance')
export class InsuranceController {
  constructor(private readonly svc: InsuranceService) {}

  // ─── Companies ────────────────────────────────────────────────────────────

  @Get('companies')
  @ApiOperation({ summary: 'List insurance companies' })
  listCompanies(@Req() req: any, @Query() query: any) {
    return this.svc.listCompanies(req.tenantId, query);
  }

  @Post('companies')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create an insurance company' })
  createCompany(@Req() req: any, @Body() dto: any) {
    return this.svc.createCompany(req.tenantId, dto);
  }

  @Get('companies/:id')
  @ApiOperation({ summary: 'Get an insurance company with its plans' })
  getCompany(@Req() req: any, @Param('id') id: string) {
    return this.svc.getCompany(req.tenantId, id);
  }

  @Patch('companies/:id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update an insurance company' })
  updateCompany(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateCompany(req.tenantId, id, dto);
  }

  @Delete('companies/:id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Deactivate an insurance company' })
  removeCompany(@Req() req: any, @Param('id') id: string) {
    return this.svc.removeCompany(req.tenantId, id);
  }

  // ─── Plans ────────────────────────────────────────────────────────────────

  @Get('plans')
  @ApiOperation({ summary: 'List insurance plans (filter by companyId, category)' })
  listPlans(@Req() req: any, @Query() query: any) {
    return this.svc.listPlans(req.tenantId, query);
  }

  @Post('plans')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create an insurance plan' })
  createPlan(@Req() req: any, @Body() dto: any) {
    return this.svc.createPlan(req.tenantId, dto);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get an insurance plan' })
  getPlan(@Req() req: any, @Param('id') id: string) {
    return this.svc.getPlan(req.tenantId, id);
  }

  @Patch('plans/:id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update an insurance plan' })
  updatePlan(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updatePlan(req.tenantId, id, dto);
  }

  @Delete('plans/:id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Deactivate an insurance plan' })
  removePlan(@Req() req: any, @Param('id') id: string) {
    return this.svc.removePlan(req.tenantId, id);
  }
}
