import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { DeletionRequestsService } from './deletion-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, Roles } from '../../common/decorators/roles.decorator';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { UserRole } from '@prisma/client';

@Controller('api/deletion-requests')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DeletionRequestsController {
  constructor(private readonly deletionService: DeletionRequestsService) {}

  @Post()
  async requestDeletion(
    @CurrentUser() user: any,
    @Body() body: { entityType: string; entityId: string; reason?: string }
  ) {
    return this.deletionService.createRequest(
      user.tenantId,
      user.userId,
      body.entityType,
      body.entityId,
      body.reason
    );
  }

  @Get()
  @UseGuards(RbacGuard)
  @Roles(UserRole.OWNER, UserRole.SUPERADMIN)
  async findAll(@CurrentUser() user: any) {
    const data = await this.deletionService.findAll(user.tenantId);
    return { data };
  }

  @Put(':id/resolve')
  @UseGuards(RbacGuard)
  @Roles(UserRole.OWNER, UserRole.SUPERADMIN)
  async resolveRequest(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { action: 'APPROVED' | 'REJECTED' }
  ) {
    return this.deletionService.resolveRequest(user.tenantId, id, user.userId, body.action);
  }
}
