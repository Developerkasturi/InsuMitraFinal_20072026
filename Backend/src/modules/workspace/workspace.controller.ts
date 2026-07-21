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
  @ApiOperation({ summary: 'Mark attendance for the day' })
  clockIn(@CurrentUser() user: any) {
    return this.svc.clockIn(user.tenantId, user.id);
  }

  @Post('clock-out')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'End attendance for the day' })
  clockOut(@CurrentUser() user: any) {
    return this.svc.clockOut(user.tenantId, user.id);
  }

  @Post('log')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Save EOD entry for today' })
  saveEod(
    @CurrentUser() user: any,
    @Body() body: {
      notes?: string;
      callsMade?: number;
      visitsCompleted?: number;
      premiumCollected?: number;
      nextDayPlan?: string;
    }
  ) {
    return this.svc.saveEod(user.tenantId, user.id, body);
  }
}
