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
      isActive: { not: false },
    };

    if (search) {
      where.AND = [
        {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName:  { contains: search, mode: 'insensitive' } },
            { phone:     { contains: search } },
          ],
        },
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
                    checkIn: true, checkOut: true, notes: true,
                    callsMade: true, visitsCompleted: true, premiumCollected: true,
                    nextDayPlan: true, adminRemarks: true,
                  },
                  take: 1,
                },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employeeProfile.count({ where }),
    ]);

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
    for (const field of ['bankName', 'bankAccountNumber', 'bankIfscCode', 'bankBranch', 'bankAccountType', 'aadhaarNumber']) {
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
    aadhaarNumber?: string | null;
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
    const aadhaarNumber = dto.aadhaarNumber || null;
    const bankName = dto.bankName || null;
    const bankAccountNumber = dto.bankAccountNumber || null;
    const bankIfscCode = dto.bankIfscCode || null;
    const bankBranch = dto.bankBranch || null;
    const bankAccountType = dto.bankAccountType || null;

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { tenantId, email: dto.email, passwordHash, role: UserRole.EMPLOYEE, isActive: true },
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
          aadhaarNumber,
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
          isActive:    true,
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
    const skip  = (page - 1) * limit;

    const where: any = { tenantId };
    if (role === UserRole.EMPLOYEE) {
      where.assignedToId = userId;
    }

    const [tasks, total] = await Promise.all([
      this.prisma.employeeTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.employeeTask.count({ where }),
    ]);

    return { data: tasks, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async createTask(tenantId: string, createdById: string, dto: {
    assignedToId: string; title: string; description?: string;
    dueDate?: string | Date; priority?: any;
  }) {
    const task = await this.prisma.employeeTask.create({
      data: {
        tenantId,
        createdById,
        assignedToId: dto.assignedToId,
        title:        dto.title,
        description:  dto.description,
        dueDate:      dto.dueDate ? new Date(dto.dueDate) : new Date(),
        priority:     dto.priority || 'MEDIUM',
      },
    });

    // Notify assigned employee
    this.notifEngine.notifyTaskAssigned(tenantId, dto.assignedToId, task.id, task.title).catch(() => {});

    return { data: task, message: 'Task assigned' };
  }

  async updateTaskStatus(tenantId: string, taskId: string, status: any) {
    const task = await this.prisma.employeeTask.findFirst({ where: { id: taskId, tenantId } });
    if (!task) throw new NotFoundException('Task not found');

    const updated = await this.prisma.employeeTask.update({
      where: { id: taskId },
      data:  { status },
    });

    return { data: updated, message: 'Task status updated' };
  }

  // ── Daily Logs ─────────────────────────────────────────────────────────────

  async checkIn(tenantId: string, userId: string, notes?: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = new Date(`${year}-${month}-${day}`);

    const existing = await this.prisma.employeeDailyLog.findUnique({
      where: { userId_logDate: { userId, logDate: today } },
    });

    if (existing && existing.checkIn) {
      return { data: existing, message: 'Already checked in today' };
    }

    const log = await this.prisma.employeeDailyLog.upsert({
      where:  { userId_logDate: { userId, logDate: today } },
      create: { tenantId, userId, logDate: today, checkIn: now, notes },
      update: { checkIn: now, notes: notes ?? undefined },
    });

    return { data: log, message: 'Checked in successfully' };
  }

  async checkOut(tenantId: string, userId: string, dto: {
    callsMade?: number; visitsCompleted?: number;
    premiumCollected?: number; nextDayPlan?: string; notes?: string;
  }) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = new Date(`${year}-${month}-${day}`);

    const log = await this.prisma.employeeDailyLog.upsert({
      where:  { userId_logDate: { userId, logDate: today } },
      create: {
        tenantId, userId, logDate: today,
        checkOut:         now,
        callsMade:        dto.callsMade        ?? 0,
        visitsCompleted:  dto.visitsCompleted  ?? 0,
        premiumCollected: dto.premiumCollected ?? 0,
        nextDayPlan:      dto.nextDayPlan,
        notes:            dto.notes,
      },
      update: {
        checkOut:         now,
        callsMade:        dto.callsMade,
        visitsCompleted:  dto.visitsCompleted,
        premiumCollected: dto.premiumCollected,
        nextDayPlan:      dto.nextDayPlan,
        notes:            dto.notes,
      },
    });

    return { data: log, message: 'Checked out successfully' };
  }

  async getAttendanceReport(tenantId: string, startDate?: string, endDate?: string) {
    const where: any = { tenantId };
    if (startDate || endDate) {
      where.logDate = {};
      if (startDate) where.logDate.gte = new Date(startDate);
      if (endDate)   where.logDate.lte = new Date(endDate);
    }

    const logs = await this.prisma.employeeDailyLog.findMany({
      where,
      orderBy: { logDate: 'desc' },
    });

    return { data: logs };
  }
}
