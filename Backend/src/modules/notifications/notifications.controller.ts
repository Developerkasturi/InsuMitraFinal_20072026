import { Controller, Delete, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard }         from '../auth/guards/jwt-auth.guard';
import { RbacGuard }            from '../../common/guards/rbac.guard';
import { Roles, CurrentUser }   from '../../common/decorators/roles.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @Roles(UserRole.EMPLOYEE)
  list(@CurrentUser() user: any, @Query() query: any) {
    return this.svc.list(user.tenantId, user.id, query);
  }

  @Patch(':id/read')
  @Roles(UserRole.EMPLOYEE)
  markRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.markRead(user.tenantId, user.id, id);
  }

  @Patch('read-all')
  @Roles(UserRole.EMPLOYEE)
  markAllRead(@CurrentUser() user: any) {
    return this.svc.markAllRead(user.tenantId, user.id);
  }

  @Get('count')
  @Roles(UserRole.EMPLOYEE)
  countUnread(@CurrentUser() user: any) {
    return this.svc.countUnread(user.tenantId, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.EMPLOYEE)
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.delete(user.tenantId, user.id, id);
  }
}
