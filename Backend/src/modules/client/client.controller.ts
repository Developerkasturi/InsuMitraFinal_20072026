// ─────────────────────────────────────────────────────────────────────────────
// Client Controller — read-only portal for CONTACT-role users
// Base: /client
// ─────────────────────────────────────────────────────────────────────────────
import {
  Controller, Get, Patch, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { ClientService }  from './client.service';
import { JwtAuthGuard }   from '../auth/guards/jwt-auth.guard';
import { RbacGuard }      from '../../common/guards/rbac.guard';
import { Roles, CurrentUser } from '../../common/decorators/roles.decorator';

@ApiTags('Client Portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Roles(UserRole.CONTACT)
@Controller('client')
export class ClientController {
  constructor(private readonly svc: ClientService) {}

  // ── Profile ───────────────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get logged-in client profile' })
  getProfile(@CurrentUser() user: any) {
    return this.svc.getProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update phone / email / notes on own profile' })
  updateProfile(@CurrentUser() user: any, @Body() dto: { phone?: string; email?: string; notes?: string }) {
    return this.svc.updateProfile(user.id, dto);
  }

  // ── Policies ──────────────────────────────────────────────────────────────

  @Get('policies')
  @ApiOperation({ summary: 'List all policies belonging to this client' })
  getPolicies(@CurrentUser() user: any) {
    return this.svc.getPolicies(user.id);
  }

  @Get('policies/:policyId')
  @ApiOperation({ summary: 'Get a single policy detail (must belong to this client)' })
  getPolicyDetail(@CurrentUser() user: any, @Param('policyId') policyId: string) {
    return this.svc.getPolicyDetail(user.id, policyId);
  }

  // ── Claims ────────────────────────────────────────────────────────────────

  @Get('claims')
  @ApiOperation({ summary: 'List all claims for this client' })
  getClaims(@CurrentUser() user: any) {
    return this.svc.getClaims(user.id);
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  @Get('documents')
  @ApiOperation({ summary: 'List all documents uploaded for this client' })
  getDocuments(@CurrentUser() user: any) {
    return this.svc.getDocuments(user.id);
  }
}
