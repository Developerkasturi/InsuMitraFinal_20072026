import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole, TaskStatus } from '@prisma/client';
import * as dayjs from 'dayjs';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspaceData(tenantId: string, userId: string, role: UserRole) {
    const todayStr = dayjs().format('YYYY-MM-DD');
    const todayDate = new Date(todayStr);

    // 1. Get daily log status for today
    const dailyLog = await this.prisma.employeeDailyLog.findFirst({
      where: {
        userId,
        logDate: todayDate,
      },
    });

    // 2. Count metrics scoped by role
    let leadsCount = 0;
    let policiesCount = 0;
    let claimsCount = 0;
    let contactsCount = 0;

    if (role === UserRole.EMPLOYEE) {
      // Employees count assigned records
      leadsCount = await this.prisma.productInterest.count({
        where: { tenantId, assignedEmployeeId: userId },
      });
      policiesCount = await this.prisma.policy.count({
        where: { tenantId, assignedEmployeeId: userId, deletedAt: null },
      });
      claimsCount = await this.prisma.claim.count({
        where: { tenantId, assignedEmployeeId: userId, deletedAt: null },
      });

      // Contacts they are linked to via active Policies, Leads, or Claims
      const [pContacts, lContacts, cContacts] = await Promise.all([
        this.prisma.policy.findMany({
          where: { tenantId, assignedEmployeeId: userId, deletedAt: null },
          select: { contactId: true },
        }),
        this.prisma.productInterest.findMany({
          where: { tenantId, assignedEmployeeId: userId },
          select: { contactId: true },
        }),
        this.prisma.claim.findMany({
          where: { tenantId, assignedEmployeeId: userId, deletedAt: null },
          select: { contactId: true },
        }),
      ]);

      const contactIds = new Set([
        ...pContacts.map(p => p.contactId),
        ...lContacts.map(l => l.contactId),
        ...cContacts.map(c => c.contactId),
      ]);
      contactsCount = contactIds.size;
    } else {
      // Owners / Admin count all records in tenant
      leadsCount = await this.prisma.productInterest.count({
        where: { tenantId },
      });
      policiesCount = await this.prisma.policy.count({
        where: { tenantId, deletedAt: null },
      });
      claimsCount = await this.prisma.claim.count({
        where: { tenantId, deletedAt: null },
      });
      contactsCount = await this.prisma.contact.count({
        where: { tenantId, deletedAt: null },
      });
    }

    // 3. Get incomplete tasks
    const tasks = await this.prisma.employeeTask.findMany({
      where: {
        tenantId,
        assignedToId: userId,
        status: { not: TaskStatus.COMPLETED },
        deletedAt: null,
      },
      orderBy: { dueDate: 'asc' },
    });

    // 4. Calculate targets progress (Policies sold this month vs monthly target)
    let monthlyTarget = 0;
    let targetProgress = 0;
    let baseSalary = 0;
    let bonusPlanned = 0;
    let callsTarget = 0;
    let visitsTarget = 0;
    let callsProgress = 0;
    let visitsProgress = 0;

    const startOfMonth = dayjs().startOf('month').toDate();
    const endOfMonth = dayjs().endOf('month').toDate();

    if (role === UserRole.EMPLOYEE) {
      const profile = await this.prisma.employeeProfile.findFirst({
        where: { userId, tenantId },
      });
      monthlyTarget = profile?.monthlyTarget || 0;
      baseSalary = profile?.baseSalary || 0;
      bonusPlanned = profile?.bonusPlanned || 0;
      callsTarget = profile?.callsTarget || 0;
      visitsTarget = profile?.visitsTarget || 0;

      // Sum premium amount of policies sold (started) this month by this employee
      const aggregate = await this.prisma.policy.aggregate({
        where: {
          tenantId,
          assignedEmployeeId: userId,
          startDate: { gte: startOfMonth, lte: endOfMonth },
          deletedAt: null,
        },
        _sum: {
          premiumAmount: true,
        },
      });
      targetProgress = aggregate._sum.premiumAmount || 0;

      const logAggregate = await this.prisma.employeeDailyLog.aggregate({
        where: {
          tenantId,
          userId,
          logDate: { gte: startOfMonth, lte: endOfMonth }
        },
        _sum: {
          callsMade: true,
          visitsCompleted: true
        }
      });
      callsProgress = logAggregate._sum.callsMade || 0;
      visitsProgress = logAggregate._sum.visitsCompleted || 0;
    } else {
      // For owners, target could be the sum of all employees targets, and progress is total sales
      const profilesAgg = await this.prisma.employeeProfile.aggregate({
        where: { tenantId, isActive: true },
        _sum: {
          monthlyTarget: true,
          baseSalary: true,
          bonusPlanned: true,
          callsTarget: true,
          visitsTarget: true
        },
      });
      monthlyTarget = profilesAgg._sum.monthlyTarget || 0;
      baseSalary = profilesAgg._sum.baseSalary || 0;
      bonusPlanned = profilesAgg._sum.bonusPlanned || 0;
      callsTarget = profilesAgg._sum.callsTarget || 0;
      visitsTarget = profilesAgg._sum.visitsTarget || 0;

      const aggregate = await this.prisma.policy.aggregate({
        where: {
          tenantId,
          startDate: { gte: startOfMonth, lte: endOfMonth },
          deletedAt: null,
        },
        _sum: {
          premiumAmount: true,
        },
      });
      targetProgress = aggregate._sum.premiumAmount || 0;

      const logAggregate = await this.prisma.employeeDailyLog.aggregate({
        where: {
          tenantId,
          logDate: { gte: startOfMonth, lte: endOfMonth }
        },
        _sum: {
          callsMade: true,
          visitsCompleted: true
        }
      });
      callsProgress = logAggregate._sum.callsMade || 0;
      visitsProgress = logAggregate._sum.visitsCompleted || 0;
    }

    // Sum commission earned this month
    let monthlyCommission = 0;
    const commAgg = await this.prisma.commission.aggregate({
      where: {
        tenantId,
        ...(role === UserRole.EMPLOYEE ? { beneficiaryId: userId } : {}),
        createdAt: { gte: startOfMonth, lte: endOfMonth }
      },
      _sum: {
        amount: true
      }
    });
    monthlyCommission = commAgg._sum.amount || 0;

    // 5. Recent daily logs (last 7 logs)
    const recentLogs = await this.prisma.employeeDailyLog.findMany({
      where: { userId, tenantId },
      orderBy: { logDate: 'desc' },
      take: 7,
    });

    return {
      dailyLog,
      counts: {
        leads: leadsCount,
        policies: policiesCount,
        claims: claimsCount,
        contacts: contactsCount,
      },
      tasks,
      target: {
        monthlyTarget,
        progress: targetProgress,
        percentage: monthlyTarget > 0 ? Math.min(100, Math.round((targetProgress / monthlyTarget) * 100)) : 0,
        baseSalary,
        bonusPlanned,
        callsTarget,
        visitsTarget,
        callsProgress,
        visitsProgress,
        monthlyCommission,
      },
      recentLogs,
    };
  }

  // ─── Daily Clock In / Out actions ──────────────────────────────────────────
  async clockIn(tenantId: string, userId: string) {
    const todayStr = dayjs().format('YYYY-MM-DD');
    const todayDate = new Date(todayStr);

    const existing = await this.prisma.employeeDailyLog.findFirst({
      where: { userId, logDate: todayDate },
    });

    if (existing && existing.checkIn) {
      return { data: existing, message: 'Already clocked in today' };
    }

    const log = await this.prisma.employeeDailyLog.upsert({
      where: { userId_logDate: { userId, logDate: todayDate } },
      create: {
        tenantId,
        userId,
        logDate: todayDate,
        checkIn: new Date(),
      },
      update: {
        checkIn: new Date(),
      },
    });

    return { data: log, message: 'Clocked in successfully' };
  }

  async clockOut(tenantId: string, userId: string, eodData?: {
    notes?: string;
    callsMade?: number;
    visitsCompleted?: number;
    premiumCollected?: number;
    nextDayPlan?: string;
  }) {
    const todayStr = dayjs().format('YYYY-MM-DD');
    const todayDate = new Date(todayStr);

    const existing = await this.prisma.employeeDailyLog.findFirst({
      where: { userId, logDate: todayDate },
    });

    if (!existing || !existing.checkIn) {
      throw new Error('Must clock in before clocking out');
    }

    const log = await this.prisma.employeeDailyLog.update({
      where: { userId_logDate: { userId, logDate: todayDate } },
      data: {
        checkOut: new Date(),
        notes: eodData?.notes || existing.notes,
        callsMade: eodData?.callsMade !== undefined ? Number(eodData.callsMade) : existing.callsMade,
        visitsCompleted: eodData?.visitsCompleted !== undefined ? Number(eodData.visitsCompleted) : existing.visitsCompleted,
        premiumCollected: eodData?.premiumCollected !== undefined ? Number(eodData.premiumCollected) : existing.premiumCollected,
        nextDayPlan: eodData?.nextDayPlan || existing.nextDayPlan,
      },
    });

    return { data: log, message: 'Clocked out successfully' };
  }
}
