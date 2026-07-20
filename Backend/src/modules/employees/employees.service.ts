// ─────────────────────────────────────────────────────────────────────────────
// Employees Service — profiles, tasks, daily logs
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import { UserRole }      from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifEngine: NotificationEngineService,
  ) {}

  // ── List employees ────────────────────────────────────────────────────────

  async findAll(tenantId: string, query: { page?: number; limit?: number; search?: string }) {
    const page  = Math.max(1, parseInt(String(query.page  ?? 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? 20), 10) || 20));
    const { search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      isActive: true,
      user: { role: { not: UserRole.CONTACT } },
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { phone:     { contains: search } },
      ];
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = new Date(`${year}-${month}-${day}`);

    const [data, total] = await Promise.all([
      this.prisma.employeeProfile.findMany({
        where,
        skip,
        take:    limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              permissions: true,
              lastLoginAt: true,
              dailyLogs: {
                where: { logDate: today },
                select: {
                  checkIn: true,
                  checkOut: true,
                  notes: true,
                  callsMade: true,
                  visitsCompleted: true,
                  premiumCollected: true,
                  nextDayPlan: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employeeProfile.count({ where }),
    ]);

    console.log('[findAll DB RESULT]', JSON.stringify(data[0], null, 2));

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ── Single employee with stats ─────────────────────────────────────────────

  async findOne(tenantId: string, employeeId: string) {
    const profile = await this.prisma.employeeProfile.findFirst({
      where:   { id: employeeId, tenantId },
      include: { user: { select: { email: true, role: true, lastLoginAt: true } } },
    });
    if (!profile) throw new NotFoundException('Employee not found');

    // Aggregate stats
    const [assignedLeads, assignedPolicies, completedTasks, pendingTasks] = await Promise.all([
      this.prisma.productInterest.count({ where: { tenantId, assignedEmployeeId: profile.userId } }),
      this.prisma.policy.count({ where: { tenantId, assignedEmployeeId: profile.userId, status: 'ACTIVE' } }),
      this.prisma.employeeTask.count({ where: { tenantId, assignedToId: profile.userId, status: 'COMPLETED' } }),
      this.prisma.employeeTask.count({ where: { tenantId, assignedToId: profile.userId, status: 'PENDING' } }),
    ]);

    return { data: { ...profile, stats: { assignedLeads, assignedPolicies, completedTasks, pendingTasks } } };
  }

  async update(tenantId: string, id: string, dto: any) {
    const profile = await this.prisma.employeeProfile.findFirst({ where: { id, tenantId } });
    if (!profile) throw new NotFoundException('Employee not found');

    const data: any = { ...dto };
    for (const field of ['dateOfJoining', 'dateOfBirth']) {
      if (data[field] === '' || data[field] === null || data[field] === undefined) {
        data[field] = null;
      } else if (typeof data[field] === 'string') {
        data[field] = new Date(data[field]);
      }
    }
    for (const field of ['baseSalary', 'bonusPlanned', 'monthlyTarget', 'callsTarget', 'visitsTarget']) {
      if (data[field] === '' || data[field] === null || data[field] === undefined) {
        data[field] = null;
      } else {
        data[field] = Number(data[field]);
      }
    }
    if (data.gender === '' || data.gender === undefined || data.gender === null) {
      data.gender = null;
    }
    for (const field of ['bankName', 'bankAccountNumber', 'bankIfscCode', 'bankBranch', 'bankAccountType']) {
      if (data[field] === '' || data[field] === undefined) {
        data[field] = null;
      }
    }
    // Remove undefined keys so Prisma doesn't touch untouched fields
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    const updated = await this.prisma.employeeProfile.update({ where: { id }, data });
    return { data: updated, message: 'Employee updated' };
  }

  async create(tenantId: string, dto: {
    email: string; password: string;
    firstName: string; lastName: string; phone: string;
    designation?: string; department?: string;
    dateOfJoining?: string | Date | null;
    dateOfBirth?: string | Date | null;
    gender?: any;
    baseSalary?: number | string | null;
    bonusPlanned?: number | string | null;
    monthlyTarget?: number | string | null;
    callsTarget?: number | string | null;
    visitsTarget?: number | string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankIfscCode?: string | null;
    bankBranch?: string | null;
    bankAccountType?: string | null;
    contactId?: string | null;
  }) {
    const exists = await this.prisma.user.findFirst({ where: { tenantId, email: dto.email } });
    if (exists) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    let dateOfJoining: Date | null = null;
    if (dto.dateOfJoining && dto.dateOfJoining !== '') {
      dateOfJoining = new Date(dto.dateOfJoining);
    }
    let dateOfBirth: Date | null = null;
    if (dto.dateOfBirth && dto.dateOfBirth !== '') {
      dateOfBirth = new Date(dto.dateOfBirth);
    }
    const baseSalary = dto.baseSalary != null && dto.baseSalary !== '' ? Number(dto.baseSalary) : null;
    const bonusPlanned = dto.bonusPlanned != null && dto.bonusPlanned !== '' ? Number(dto.bonusPlanned) : null;
    const monthlyTarget = dto.monthlyTarget != null && dto.monthlyTarget !== '' ? Number(dto.monthlyTarget) : null;
    const callsTarget = dto.callsTarget != null && dto.callsTarget !== '' ? Number(dto.callsTarget) : 0;
    const visitsTarget = dto.visitsTarget != null && dto.visitsTarget !== '' ? Number(dto.visitsTarget) : 0;
    const gender = dto.gender && dto.gender !== '' ? dto.gender : null;
    const bankName = dto.bankName || null;
    const bankAccountNumber = dto.bankAccountNumber || null;
    const bankIfscCode = dto.bankIfscCode || null;
    const bankBranch = dto.bankBranch || null;
    const bankAccountType = dto.bankAccountType || null;

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { tenantId, email: dto.email, passwordHash, role: UserRole.EMPLOYEE },
      });

      if (dto.contactId) {
        await tx.contact.update({
          where: { id: dto.contactId, tenantId },
          data:  { userId: user.id },
        });
      }

      const profile = await tx.employeeProfile.create({
        data: {
          tenantId,
          userId:      user.id,
          firstName:   dto.firstName,
          lastName:    dto.lastName,
          phone:       dto.phone,
          designation: dto.designation,
          department:  dto.department,
          dateOfJoining,
          dateOfBirth,
          gender,
          baseSalary,
          bonusPlanned,
          monthlyTarget,
          callsTarget,
          visitsTarget,
          bankName,
          bankAccountNumber,
          bankIfscCode,
          bankBranch,
          bankAccountType,
        },
        include: { user: { select: { email: true, role: true } } },
      });
      return profile;
    });

    return { data: result, message: 'Employee created' };
  }

  async deactivate(tenantId: string, id: string) {
    const profile = await this.prisma.employeeProfile.findFirst({ where: { id, tenantId } });
    if (!profile) throw new NotFoundException('Employee not found');

    await Promise.all([
      this.prisma.employeeProfile.update({ where: { id }, data: { isActive: false } }),
      this.prisma.user.update({ where: { id: profile.userId }, data: { isActive: false } }),
    ]);

    return { data: null, message: 'Employee deactivated' };
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async getTasks(tenantId: string, userId: string, role: UserRole, query: any) {
    const page  = Math.max(1, parseInt(String(query.page  ?? 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? 20), 10) || 20));
    const { status } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (role === UserRole.EMPLOYEE) where.assignedToId = userId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.employeeTask.findMany({
        where,
        skip,
        take:    limit,
        include: {
          assignedTo: { include: { employeeProfile: { select: { firstName: true, lastName: true } } } },
          createdBy:  { include: { employeeProfile: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employeeTask.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async createTask(tenantId: string, createdById: string, dto: any) {
    // When no assignee is specified (e.g. self-created task from the Workspace
    // page), default to the creator. Both Employee and Owner creating a task
    // for themselves follow this path; Owner assigning to someone else sends
    // an explicit assignedToId which takes precedence.
    const assignedToId = dto.assignedToId ?? createdById;

    const task = await this.prisma.employeeTask.create({
      data: { ...dto, tenantId, createdById, assignedToId },
    });

    // Notify assignee (skip self-notification when creator == assignee)
    if (assignedToId !== createdById) {
      await this.notifEngine.notifyTaskAssigned(tenantId, assignedToId, task.id, dto.title);
    }

    return { data: task, message: 'Task created' };
  }

  async updateTaskStatus(tenantId: string, taskId: string, status: string) {
    const task = await this.prisma.employeeTask.findFirst({ where: { id: taskId, tenantId } });
    if (!task) throw new NotFoundException('Task not found');

    const updated = await this.prisma.employeeTask.update({
      where: { id: taskId },
      data:  {
        status:      status as any,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
      },
    });
    return { data: updated, message: `Task marked ${status}` };
  }

  // ── Daily Logs ─────────────────────────────────────────────────────────────

  async getDailyLogs(tenantId: string, userId: string, query: { startDate?: string; endDate?: string }) {
    const where: any = { tenantId, userId };
    if (query.startDate) where.logDate = { gte: new Date(query.startDate) };
    if (query.endDate)   where.logDate = { ...where.logDate, lte: new Date(query.endDate) };

    const logs = await this.prisma.employeeDailyLog.findMany({
      where,
      orderBy: { logDate: 'desc' },
    });
    return { data: logs };
  }

  async upsertDailyLog(tenantId: string, userId: string, dto: any) {
    const dateVal = dto.date ?? dto.logDate;
    let logDate: Date;
    if (typeof dateVal === 'string') {
      logDate = new Date(dateVal.slice(0, 10));
    } else {
      const dObj = new Date(dateVal);
      const y = dObj.getFullYear();
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const d = String(dObj.getDate()).padStart(2, '0');
      logDate = new Date(`${y}-${m}-${d}`);
    }

    const data: any = {
      callsMade: dto.callsMade !== undefined ? Number(dto.callsMade) : undefined,
      visitsCompleted: (dto.visitsCompleted !== undefined ? Number(dto.visitsCompleted) : undefined) || (dto.meetingsDone !== undefined ? Number(dto.meetingsDone) : undefined),
      premiumCollected: dto.premiumCollected !== undefined ? Number(dto.premiumCollected) : undefined,
      notes: dto.notes || undefined,
      nextDayPlan: dto.nextDayPlan || undefined,
      isEditedByAdmin: dto.isEditedByAdmin !== undefined ? Boolean(dto.isEditedByAdmin) : undefined,
      adminRemarks: dto.adminRemarks || undefined,
    };

    // Remove undefined values
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    // Set default checkIn & checkOut times for manual entries so they count as present
    if (dto.checkIn) data.checkIn = new Date(dto.checkIn);
    else data.checkIn = new Date(logDate.getTime() + 9 * 60 * 60 * 1000); // 9:00 AM

    if (dto.checkOut) data.checkOut = new Date(dto.checkOut);
    else data.checkOut = new Date(logDate.getTime() + 18 * 60 * 60 * 1000); // 6:00 PM

    const log = await this.prisma.employeeDailyLog.upsert({
      where:  { userId_logDate: { userId, logDate } },
      create: { tenantId, userId, ...data, logDate },
      update: { ...data, logDate },
    });
    return { data: log, message: 'Daily log saved' };
  }

  /** Called from POST /employees/:id/log  (id = employeeProfile id) */
  async logForEmployee(tenantId: string, employeeProfileId: string, dto: any) {
    const profile = await this.prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, tenantId },
    });
    if (!profile) throw new NotFoundException('Employee not found');
    return this.upsertDailyLog(tenantId, profile.userId, {
      ...dto,
      isEditedByAdmin: true,
      adminRemarks: dto.notes || dto.adminRemarks,
    });
  }

  /** Called from GET /employees/:id/tasks */
  async getTasksForEmployee(tenantId: string, employeeProfileId: string, query: any) {
    const profile = await this.prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, tenantId },
    });
    if (!profile) throw new NotFoundException('Employee not found');

    const where: any = { tenantId, assignedToId: profile.userId };
    if (query.status) where.status = query.status;

    const tasks = await this.prisma.employeeTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return { data: tasks };
  }

  /** Called from POST /employees/:id/tasks */
  async addTaskForEmployee(tenantId: string, employeeProfileId: string, createdById: string, dto: any) {
    const profile = await this.prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, tenantId },
    });
    if (!profile) throw new NotFoundException('Employee not found');

    const data: any = {
      title: dto.title,
      description: dto.description || null,
      priority: dto.priority || 'MEDIUM',
      tenantId,
      assignedToId: profile.userId,
      createdById,
    };

    if (dto.dueDate && dto.dueDate !== '') {
      data.dueDate = new Date(dto.dueDate);
    } else {
      data.dueDate = null;
    }

    const task = await this.prisma.employeeTask.create({
      data,
    });

    await this.notifEngine.notifyTaskAssigned(tenantId, profile.userId, task.id, dto.title);
    return { data: task, message: 'Task created' };
  }

  async getStats(tenantId: string, employeeProfileId: string) {
    const profile = await this.prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, tenantId },
    });
    if (!profile) throw new NotFoundException('Employee not found');

    const userId = profile.userId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      totalPolicies,
      totalLeads,
      policies,
      todayLog,
      monthlyLogs,
      leadsMonthCount,
      policiesMonthCount,
    ] = await Promise.all([
      this.prisma.policy.count({
        where: { tenantId, assignedEmployeeId: userId, status: 'ACTIVE' },
      }),
      this.prisma.productInterest.count({
        where: { tenantId, assignedEmployeeId: userId },
      }),
      this.prisma.policy.findMany({
        where: { tenantId, assignedEmployeeId: userId, status: 'ACTIVE' },
        select: { premiumAmount: true },
      }),
      this.prisma.employeeDailyLog.findFirst({
        where: { userId, logDate: todayStart },
      }),
      this.prisma.employeeDailyLog.findMany({
        where: {
          userId,
          logDate: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      this.prisma.productInterest.count({
        where: {
          tenantId,
          assignedEmployeeId: userId,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      this.prisma.policy.count({
        where: {
          tenantId,
          assignedEmployeeId: userId,
          status: 'ACTIVE',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
    ]);

    const totalRevenue = policies.reduce((sum, p) => sum + (p.premiumAmount ?? 0), 0);
    const callsToday = todayLog?.callsMade ?? 0;
    const meetingsToday = todayLog?.visitsCompleted ?? 0;
    const premiumThisMonth = monthlyLogs.reduce((sum, log) => sum + (log.premiumCollected ?? 0), 0);

    return {
      data: {
        totalPolicies,
        totalLeads,
        totalRevenue,
        callsToday,
        meetingsToday,
        leadsThisMonth: leadsMonthCount,
        policiesThisMonth: policiesMonthCount,
        premiumThisMonth,
      },
    };
  }

  async getLogsForEmployee(tenantId: string, employeeProfileId: string, query: { startDate?: string; endDate?: string }) {
    const profile = await this.prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, tenantId },
    });
    if (!profile) throw new NotFoundException('Employee not found');
    return this.getDailyLogs(tenantId, profile.userId, query);
  }

  async updateEmployeeRole(tenantId: string, employeeProfileId: string, role: string, permissions?: string[]) {
    const profile = await this.prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, tenantId },
    });
    if (!profile) throw new NotFoundException('Employee profile not found');

    const updatedUser = await this.prisma.user.update({
      where: { id: profile.userId },
      data: {
        role: role as any,
        permissions: permissions ?? [],
      },
    });

    return { data: updatedUser, message: 'Employee role updated successfully' };
  }
}
