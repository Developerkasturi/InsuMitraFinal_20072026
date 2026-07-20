import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles, CurrentUser } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { WorkspaceService } from './workspace.service';

@ApiTags('Workspace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly svc: WorkspaceService) {}

  @Get()
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get unified workspace data for logged in user' })
  getWorkspaceData(@CurrentUser() user: any) {
    return this.svc.getWorkspaceData(user.tenantId, user.id, user.role);
  }

  @Post('clock-in')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Clock in for the day' })
  clockIn(@CurrentUser() user: any) {
    return this.svc.clockIn(user.tenantId, user.id);
  }

  @Post('clock-out')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Clock out for the day' })
  clockOut(
    @CurrentUser() user: any,
    @Body() body?: {
      notes?: string;
      callsMade?: number;
      visitsCompleted?: number;
      premiumCollected?: number;
      nextDayPlan?: string;
    }
  ) {
    return this.svc.clockOut(user.tenantId, user.id, body);
  }
}
