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
    const startOfMonth = dayjs().startOf('month').toDate();
    const endOfMonth = dayjs().endOf('month').toDate();

    // Execute all independent data queries concurrently in parallel
    const [
      dailyLog,
      countsResult,
      tasks,
      targetMetrics,
      commAgg,
    ] = await Promise.all([
      // 1. Daily log status for today
      this.prisma.employeeDailyLog.findFirst({
        where: { userId, logDate: todayDate },
      }),

      // 2. Count metrics scoped by role
      role === UserRole.EMPLOYEE
        ? (async () => {
            const [leadsCount, policiesCount, claimsCount, pContacts, lContacts, cContacts] = await Promise.all([
              this.prisma.productInterest.count({ where: { tenantId, assignedEmployeeId: userId } }),
              this.prisma.policy.count({ where: { tenantId, assignedEmployeeId: userId, deletedAt: null } }),
              this.prisma.claim.count({ where: { tenantId, assignedEmployeeId: userId, deletedAt: null } }),
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
            return { leadsCount, policiesCount, claimsCount, contactsCount: contactIds.size };
          })()
        : (async () => {
            const [leadsCount, policiesCount, claimsCount, contactsCount] = await Promise.all([
              this.prisma.productInterest.count({ where: { tenantId } }),
              this.prisma.policy.count({ where: { tenantId, deletedAt: null } }),
              this.prisma.claim.count({ where: { tenantId, deletedAt: null } }),
              this.prisma.contact.count({ where: { tenantId, deletedAt: null } }),
            ]);
            return { leadsCount, policiesCount, claimsCount, contactsCount };
          })(),

      // 3. Incomplete tasks
      this.prisma.employeeTask.findMany({
        where: {
          tenantId,
          assignedToId: userId,
          status: { not: TaskStatus.COMPLETED },
          deletedAt: null,
        },
        orderBy: { dueDate: 'asc' },
      }),

      // 4. Targets & Progress Metrics
      role === UserRole.EMPLOYEE
        ? (async () => {
            const [profile, aggregate, logAggregate] = await Promise.all([
              this.prisma.employeeProfile.findFirst({ where: { userId, tenantId } }),
              this.prisma.policy.aggregate({
                where: {
                  tenantId,
                  assignedEmployeeId: userId,
                  startDate: { gte: startOfMonth, lte: endOfMonth },
                  deletedAt: null,
                },
                _sum: { premiumAmount: true },
              }),
              this.prisma.employeeDailyLog.aggregate({
                where: { tenantId, userId, logDate: { gte: startOfMonth, lte: endOfMonth } },
                _sum: { callsMade: true, visitsCompleted: true },
              }),
            ]);
            return {
              monthlyTarget: profile?.monthlyTarget || 0,
              baseSalary: profile?.baseSalary || 0,
              bonusPlanned: profile?.bonusPlanned || 0,
              callsTarget: profile?.callsTarget || 0,
              visitsTarget: profile?.visitsTarget || 0,
              targetProgress: aggregate._sum.premiumAmount || 0,
              callsProgress: logAggregate._sum.callsMade || 0,
              visitsProgress: logAggregate._sum.visitsCompleted || 0,
            };
          })()
        : (async () => {
            const [profilesAgg, aggregate, logAggregate] = await Promise.all([
              this.prisma.employeeProfile.aggregate({
                where: { tenantId, isActive: true },
                _sum: {
                  monthlyTarget: true,
                  baseSalary: true,
                  bonusPlanned: true,
                  callsTarget: true,
                  visitsTarget: true,
                },
              }),
              this.prisma.policy.aggregate({
                where: {
                  tenantId,
                  startDate: { gte: startOfMonth, lte: endOfMonth },
                  deletedAt: null,
                },
                _sum: { premiumAmount: true },
              }),
              this.prisma.employeeDailyLog.aggregate({
                where: { tenantId, logDate: { gte: startOfMonth, lte: endOfMonth } },
                _sum: { callsMade: true, visitsCompleted: true },
              }),
            ]);
            return {
              monthlyTarget: profilesAgg._sum.monthlyTarget || 0,
              baseSalary: profilesAgg._sum.baseSalary || 0,
              bonusPlanned: profilesAgg._sum.bonusPlanned || 0,
              callsTarget: profilesAgg._sum.callsTarget || 0,
              visitsTarget: profilesAgg._sum.visitsTarget || 0,
              targetProgress: aggregate._sum.premiumAmount || 0,
              callsProgress: logAggregate._sum.callsMade || 0,
              visitsProgress: logAggregate._sum.visitsCompleted || 0,
            };
          })(),

      // 5. Monthly Commission
      this.prisma.commission.aggregate({
        where: {
          tenantId,
          ...(role === UserRole.EMPLOYEE ? { beneficiaryId: userId } : {}),
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    const { leadsCount, policiesCount, claimsCount, contactsCount } = countsResult;
    const {
      monthlyTarget, baseSalary, bonusPlanned, callsTarget, visitsTarget,
      targetProgress, callsProgress, visitsProgress
    } = targetMetrics;

    const monthlyCommission = commAgg._sum.amount || 0;
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

  async clockOut(tenantId: string, userId: string) {
    const todayStr = dayjs().format('YYYY-MM-DD');
    const todayDate = new Date(todayStr);

    const existing = await this.prisma.employeeDailyLog.findFirst({
      where: { userId, logDate: todayDate },
    });

    if (!existing || !existing.checkIn) {
      throw new Error('Must mark attendance before ending attendance');
    }

    const log = await this.prisma.employeeDailyLog.update({
      where: { userId_logDate: { userId, logDate: todayDate } },
      data: {
        checkOut: new Date(),
      },
    });

    return { data: log, message: 'Attendance ended successfully' };
  }

  async saveEod(tenantId: string, userId: string, eodData: {
    notes?: string;
    callsMade?: number;
    visitsCompleted?: number;
    premiumCollected?: number;
    nextDayPlan?: string;
  }) {
    const todayStr = dayjs().format('YYYY-MM-DD');
    const todayDate = new Date(todayStr);

    const data: any = {
      notes: eodData.notes,
      callsMade: eodData.callsMade !== undefined ? Number(eodData.callsMade) : undefined,
      visitsCompleted: eodData.visitsCompleted !== undefined ? Number(eodData.visitsCompleted) : undefined,
      premiumCollected: eodData.premiumCollected !== undefined ? Number(eodData.premiumCollected) : undefined,
      nextDayPlan: eodData.nextDayPlan,
    };

    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    const log = await this.prisma.employeeDailyLog.upsert({
      where: { userId_logDate: { userId, logDate: todayDate } },
      create: {
        tenantId,
        userId,
        logDate: todayDate,
        ...data,
      },
      update: {
        ...data,
      },
    });

    return { data: log, message: 'EOD report saved successfully' };
  }
}
