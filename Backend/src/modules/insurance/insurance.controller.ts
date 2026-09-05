import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards, Put
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

  @Get('companies/:id/plans')
  @ApiOperation({ summary: 'Get plans for an insurance company' })
  getCompanyPlans(@Req() req: any, @Param('id') id: string) {
    return this.svc.listPlans(req.tenantId, { companyId: id });
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

  // ─── Hospitals ────────────────────────────────────────────────────────────

  @Get('hospitals')
  @ApiOperation({ summary: 'List hospitals (with doctors)' })
  listHospitals(@Req() req: any) {
    return this.svc.listHospitals(req.tenantId);
  }

  @Post('hospitals')
  @ApiOperation({ summary: 'Create a hospital with doctors' })
  createHospital(@Req() req: any, @Body() dto: any) {
    return this.svc.createHospital(req.tenantId, dto);
  }

  @Delete('hospitals/:id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete a hospital' })
  removeHospital(@Req() req: any, @Param('id') id: string) {
    return this.svc.removeHospital(req.tenantId, id);
  }

  // ─── Compulsory Field Rules ───────────────────────────────────────────────

  @Get('compulsory-rules')
  @ApiOperation({ summary: 'Get compulsory field rules for tenant' })
  getCompulsoryRules(@Req() req: any) {
    return this.svc.getCompulsoryRules(req.tenantId);
  }

  @Post('compulsory-rules')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create or update compulsory field rules' })
  updateCompulsoryRules(@Req() req: any, @Body() body: { rules: { module: string; fieldKey: string; required: boolean }[] }) {
    return this.svc.updateCompulsoryRules(req.tenantId, body.rules);
  }

  @Get('table-columns')
  @ApiOperation({ summary: 'Get global table column visibility settings' })
  getTableColumnVisibility(@Req() req: any) {
    return this.svc.getTableColumnVisibility(req.tenantId);
  }

  @Put('table-columns')
  @ApiOperation({ summary: 'Update table column visibility settings' })
  updateTableColumnVisibility(@Req() req: any, @Body() body: { pageId: string; colName: string; isHidden: boolean }) {
    return this.svc.updateTableColumnVisibility(req.tenantId, body.pageId, body.colName, body.isHidden);
  }
}
