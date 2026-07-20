// ─────────────────────────────────────────────────────────────────────────────
// SuperAdmin Auth Controller
// Platform-level admin routes (separate from tenant user auth)
// Base: /superadmin/auth
// ─────────────────────────────────────────────────────────────────────────────
import {
  Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus, Param, Patch, Delete, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsEmail, MinLength }          from 'class-validator';
import { ApiProperty }                           from '@nestjs/swagger';

import { SuperAdminAuthService }  from './superadmin-auth.service';
import { SuperAdminAuthGuard }    from './guards/superadmin-auth.guard';
import { CurrentUser, Public }    from '../../common/decorators/roles.decorator';

class SuperAdminLoginDto {
  @ApiProperty() @IsEmail()   email:           string;
  @ApiProperty() @IsString()  password:        string;
}
class SuperAdminChangePwDto {
  @ApiProperty() @IsString()  currentPassword: string;
  @ApiProperty() @IsString() @MinLength(8) newPassword: string;
}

@ApiTags('SuperAdmin Auth')
@Controller('superadmin/auth')
export class SuperAdminAuthController {
  constructor(private readonly service: SuperAdminAuthService) {}

  /** Platform admin login */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SuperAdmin login' })
  login(@Body() dto: SuperAdminLoginDto) {
    return this.service.login(dto);
  }

  /** Get own profile */
  @Get('me')
  @UseGuards(SuperAdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'SuperAdmin profile' })
  me(@CurrentUser() admin: any) {
    return this.service.getSelf(admin.id);
  }

  /** Change own password */
  @Post('change-password')
  @UseGuards(SuperAdminAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  changePassword(@CurrentUser() admin: any, @Body() dto: SuperAdminChangePwDto) {
    return this.service.changePassword(admin.id, dto);
  }

  /** Platform statistics */
  @Get('platform-stats')
  @UseGuards(SuperAdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Platform-wide metrics' })
  platformStats() {
    return this.service.getPlatformStats();
  }

  /** List all tenants with pagination + search */
  @Get('tenants')
  @UseGuards(SuperAdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all tenants' })
  listTenants(@Query() query: { page?: number; limit?: number; search?: string }) {
    return this.service.listTenants(query);
  }

  /** Create a new tenant + owner account */
  @Post('tenants')
  @UseGuards(SuperAdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new tenant agency' })
  createTenant(@Body() dto: any) {
    return this.service.createTenant(dto);
  }

  /** Activate or deactivate a tenant */
  @Patch('tenants/:tenantId/status')
  @UseGuards(SuperAdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activate / deactivate a tenant' })
  setTenantStatus(
    @Param('tenantId') tenantId: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.service.setTenantStatus(tenantId, isActive);
  }

  /** Update tenant details */
  @Patch('tenants/:tenantId')
  @UseGuards(SuperAdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update tenant name / email / phone' })
  updateTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: { name?: string; email?: string; phone?: string },
  ) {
    return this.service.updateTenant(tenantId, dto);
  }

  /** Delete a tenant and all its data */
  @Delete('tenants/:tenantId')
  @UseGuards(SuperAdminAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete a tenant' })
  deleteTenant(@Param('tenantId') tenantId: string) {
    return this.service.deleteTenant(tenantId);
  }

  // ── Subscription Plans ─────────────────────────────────────────────────────

  /** List all subscription plans (including inactive) */
  @Get('plans')
  @UseGuards(SuperAdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all subscription plans' })
  listPlans() {
    return this.service.listSubscriptionPlans();
  }

  /** Create a new subscription plan */
  @Post('plans')
  @UseGuards(SuperAdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a subscription plan' })
  createPlan(@Body() dto: any) {
    return this.service.createSubscriptionPlan(dto);
  }

  /** Update an existing subscription plan */
  @Patch('plans/:planId')
  @UseGuards(SuperAdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a subscription plan' })
  updatePlan(
    @Param('planId') planId: string,
    @Body() dto: any,
  ) {
    return this.service.updateSubscriptionPlan(planId, dto);
  }

  /** Deactivate (soft-delete) a subscription plan */
  @Delete('plans/:planId')
  @UseGuards(SuperAdminAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a subscription plan' })
  deactivatePlan(@Param('planId') planId: string) {
    return this.service.deactivateSubscriptionPlan(planId);
  }

  // ── Feature Feedback (platform-wide) ──────────────────────────────────────

  /** List all feature feedback submitted by any tenant — visible to Superadmin only */
  @Get('feedback')
  @UseGuards(SuperAdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all feature feedback (platform-wide)' })
  listFeedback(@Query() query: { page?: number; limit?: number }) {
    return this.service.getAllFeedback(query);
  }
}
