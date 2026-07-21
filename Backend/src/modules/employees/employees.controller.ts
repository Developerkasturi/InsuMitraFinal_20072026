import {
  Controller, Get, Put, Delete, Post, Patch,
  Param, Body, Query, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { EmployeesService }    from './employees.service';
import { JwtAuthGuard }        from '../auth/guards/jwt-auth.guard';
import { RbacGuard }           from '../../common/guards/rbac.guard';
import { Roles, CurrentUser }  from '../../common/decorators/roles.decorator';
import { SubscriptionGuard, RequireFeature } from '../../common/guards/subscription.guard';
import { SubscriptionLimitInterceptor } from '../../common/interceptors/subscription-limit.interceptor';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard, SubscriptionGuard)
@UseInterceptors(SubscriptionLimitInterceptor)
@RequireFeature('employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly svc: EmployeesService) {}

  @Post()
  @Roles(UserRole.OWNER)
  create(@CurrentUser() user: any, @Body() dto: any) {
    return this.svc.create(user.tenantId, dto);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.EMPLOYEE)
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.svc.findAll(user.tenantId, query);
  }

  // ── Per-employee sub-resources (used by EmployeeDetail page) ──────────────

  @Get(':id/tasks')
  @Roles(UserRole.OWNER, UserRole.EMPLOYEE)
  getTasksForEmployee(@CurrentUser() user: any, @Param('id') id: string, @Query() q: any) {
    return this.svc.getTasksForEmployee(user.tenantId, id, q);
  }

  @Post(':id/tasks')
  @Roles(UserRole.OWNER)
  addTaskForEmployee(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.addTaskForEmployee(user.tenantId, id, user.id, dto);
  }

  @Post(':id/log')
  @Roles(UserRole.OWNER)
  logForEmployee(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.logForEmployee(user.tenantId, id, dto);
  }

  @Get(':id/stats')
  @Roles(UserRole.OWNER, UserRole.EMPLOYEE)
  getStats(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.getStats(user.tenantId, id);
  }

  @Get(':id/logs')
  @Roles(UserRole.OWNER, UserRole.EMPLOYEE)
  getLogsForEmployee(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.svc.getLogsForEmployee(user.tenantId, id, { startDate, endDate });
  }

  @Patch(':id/role')
  @Roles(UserRole.OWNER)
  updateEmployeeRole(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: { role: string; permissions?: string[] },
  ) {
    return this.svc.updateEmployeeRole(user.tenantId, id, dto.role, dto.permissions);
  }

  // ── Generic employee resource endpoints ───────────────────────────────────

  @Get(':id')
  @Roles(UserRole.EMPLOYEE)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.findOne(user.tenantId, id);
  }

  @Put(':id')
  @Roles(UserRole.OWNER)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.svc.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  deactivate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.deactivate(user.tenantId, id);
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  @Get('tasks/list')
  @Roles(UserRole.EMPLOYEE)
  getTasks(@CurrentUser() user: any, @Query() query: any) {
    return this.svc.getTasks(user.tenantId, user.id, user.role, query);
  }

  @Post('tasks')
  @Roles(UserRole.EMPLOYEE)
  createTask(@CurrentUser() user: any, @Body() dto: any) {
    return this.svc.createTask(user.tenantId, user.id, dto);
  }

  @Patch('tasks/:taskId/status')
  @Roles(UserRole.EMPLOYEE)
  updateTaskStatus(
    @CurrentUser() user: any,
    @Param('taskId') taskId: string,
    @Body('status') status: string,
  ) {
    return this.svc.updateTaskStatus(user.tenantId, taskId, status);
  }

  // ── Daily Logs ─────────────────────────────────────────────────────────────

  @Get('logs/daily')
  @Roles(UserRole.EMPLOYEE)
  getDailyLogs(@CurrentUser() user: any, @Query() query: any) {
    return this.svc.getDailyLogs(user.tenantId, user.id, query);
  }

  @Post('logs/daily')
  @Roles(UserRole.EMPLOYEE)
  upsertDailyLog(@CurrentUser() user: any, @Body() dto: any) {
    return this.svc.upsertDailyLog(user.tenantId, user.id, dto);
  }
}
