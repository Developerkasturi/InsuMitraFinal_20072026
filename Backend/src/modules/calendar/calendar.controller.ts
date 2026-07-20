import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CalendarService }     from './calendar.service';
import { CreateCalendarEventDto, UpdateCalendarEventDto } from './calendar.dto';
import { JwtAuthGuard }        from '../auth/guards/jwt-auth.guard';
import { RbacGuard }           from '../../common/guards/rbac.guard';
import { Roles, CurrentUser }  from '../../common/decorators/roles.decorator';

@ApiTags('Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly svc: CalendarService) {}

  @Get()
  @Roles(UserRole.EMPLOYEE)
  getEvents(@CurrentUser() user: any, @Query() query: any) {
    return this.svc.getEvents(user.tenantId, user.id, user.role, query);
  }

  @Get('upcoming')
  @Roles(UserRole.EMPLOYEE)
  getUpcoming(@CurrentUser() user: any, @Query('days') days = 7) {
    return this.svc.getUpcoming(user.tenantId, +days);
  }

  @Post()
  @Roles(UserRole.EMPLOYEE)
  createEvent(@CurrentUser() user: any, @Body() dto: CreateCalendarEventDto) {
    return this.svc.createEvent(user.tenantId, dto);
  }

  @Put(':id')
  @Roles(UserRole.EMPLOYEE)
  updateEventPut(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateCalendarEventDto) {
    return this.svc.updateEvent(user.tenantId, id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.EMPLOYEE)
  updateEvent(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateCalendarEventDto) {
    return this.svc.updateEvent(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  deleteEvent(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.deleteEvent(user.tenantId, id);
  }
}
