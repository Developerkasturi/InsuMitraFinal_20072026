import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards, Put
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard';
import { TenantGuard }   from '../../common/guards/tenant.guard';
import { RbacGuard }     from '../../common/guards/rbac.guard';
import { Roles, CurrentUser } from '../../common/decorators/roles.decorator';
import { UserRole }      from '@prisma/client';
import { InsuranceService } from './insurance.service';
import { SubscriptionGuard, RequireFeature } from '../../common/guards/subscription.guard';

@ApiTags('Insurance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RbacGuard, SubscriptionGuard)
@RequireFeature('operations')
@Controller('insurance')
export class InsuranceController {
  constructor(private readonly svc: InsuranceService) {}

  private getTenantId(req: any, user: any): string {
    return user?.tenantId || req?.user?.tenantId || req?.tenantId || (req?.headers?.['x-tenant-id'] as string) || '';
  }

  // ─── Companies ────────────────────────────────────────────────────────────

  @Get('companies')
  @ApiOperation({ summary: 'List insurance companies' })
  listCompanies(@Req() req: any, @CurrentUser() user: any, @Query() query: any) {
    return this.svc.listCompanies(this.getTenantId(req, user), query);
  }

  @Post('companies')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create an insurance company' })
  createCompany(@Req() req: any, @CurrentUser() user: any, @Body() dto: any) {
    return this.svc.createCompany(this.getTenantId(req, user), dto);
  }

  @Get('companies/:id')
  @ApiOperation({ summary: 'Get an insurance company with its plans' })
  getCompany(@Req() req: any, @CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.getCompany(this.getTenantId(req, user), id);
  }

  @Get('companies/:id/plans')
  @ApiOperation({ summary: 'Get plans for an insurance company' })
  getCompanyPlans(@Req() req: any, @CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.listPlans(this.getTenantId(req, user), { companyId: id });
  }

  @Post('companies/:id/plans')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create an insurance plan for an insurance company' })
  createCompanyPlan(@Req() req: any, @CurrentUser() user: any, @Param('id') companyId: string, @Body() dto: any) {
    return this.svc.createPlan(this.getTenantId(req, user), { ...dto, companyId });
  }

  @Patch('companies/:id')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Update an insurance company' })
  updateCompany(@Req() req: any, @CurrentUser() user: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateCompany(this.getTenantId(req, user), id, dto);
  }

  @Delete('companies/:id')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Deactivate an insurance company' })
  removeCompany(@Req() req: any, @CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.removeCompany(this.getTenantId(req, user), id);
  }

  // ─── Plans ────────────────────────────────────────────────────────────────

  @Get('plans')
  @ApiOperation({ summary: 'List insurance plans (filter by companyId, category)' })
  listPlans(@Req() req: any, @CurrentUser() user: any, @Query() query: any) {
    return this.svc.listPlans(this.getTenantId(req, user), query);
  }

  @Post('plans')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create an insurance plan' })
  createPlan(@Req() req: any, @CurrentUser() user: any, @Body() dto: any) {
    return this.svc.createPlan(this.getTenantId(req, user), dto);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get an insurance plan' })
  getPlan(@Req() req: any, @CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.getPlan(this.getTenantId(req, user), id);
  }

  @Patch('plans/:id')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Update an insurance plan' })
  updatePlan(@Req() req: any, @CurrentUser() user: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updatePlan(this.getTenantId(req, user), id, dto);
  }

  @Delete('plans/:id')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Deactivate an insurance plan' })
  removePlan(@Req() req: any, @CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.removePlan(this.getTenantId(req, user), id);
  }

  // ─── Hospitals ────────────────────────────────────────────────────────────

  @Get('hospitals')
  @ApiOperation({ summary: 'List hospitals (with doctors)' })
  listHospitals(@Req() req: any, @CurrentUser() user: any) {
    return this.svc.listHospitals(this.getTenantId(req, user));
  }

  @Post('hospitals')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a hospital with doctors' })
  createHospital(@Req() req: any, @CurrentUser() user: any, @Body() dto: any) {
    return this.svc.createHospital(this.getTenantId(req, user), dto);
  }

  @Patch('hospitals/:id')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Update a hospital and its doctors' })
  updateHospital(@Req() req: any, @CurrentUser() user: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateHospital(this.getTenantId(req, user), id, dto);
  }

  @Delete('hospitals/:id')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Delete a hospital' })
  removeHospital(@Req() req: any, @CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.removeHospital(this.getTenantId(req, user), id);
  }

  // ─── Compulsory Field Rules ───────────────────────────────────────────────

  @Get('compulsory-rules')
  @ApiOperation({ summary: 'Get compulsory field rules for tenant' })
  getCompulsoryRules(@Req() req: any, @CurrentUser() user: any) {
    return this.svc.getCompulsoryRules(this.getTenantId(req, user));
  }

  @Post('compulsory-rules')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create or update compulsory field rules' })
  updateCompulsoryRules(@Req() req: any, @CurrentUser() user: any, @Body() body: { rules: { module: string; fieldKey: string; required: boolean }[] }) {
    return this.svc.updateCompulsoryRules(this.getTenantId(req, user), body.rules);
  }

  @Delete('compulsory-rules')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Delete or reset a compulsory field rule' })
  deleteCompulsoryRule(@Req() req: any, @CurrentUser() user: any, @Query('module') module: string, @Query('fieldKey') fieldKey: string) {
    return this.svc.deleteCompulsoryRule(this.getTenantId(req, user), module, fieldKey);
  }

  @Post('compulsory-rules/reset')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Reset compulsory field rules to system default' })
  resetCompulsoryRules(@Req() req: any, @CurrentUser() user: any, @Body() body: { module?: string }) {
    return this.svc.resetCompulsoryRules(this.getTenantId(req, user), body?.module);
  }

  @Get('table-columns')
  @ApiOperation({ summary: 'Get global table column visibility settings' })
  getTableColumnVisibility(@Req() req: any, @CurrentUser() user: any) {
    return this.svc.getTableColumnVisibility(this.getTenantId(req, user));
  }

  @Put('table-columns')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Update table column visibility settings' })
  updateTableColumnVisibility(@Req() req: any, @CurrentUser() user: any, @Body() body: { pageId: string; colName: string; isHidden: boolean }) {
    return this.svc.updateTableColumnVisibility(this.getTenantId(req, user), body.pageId, body.colName, body.isHidden);
  }
}
