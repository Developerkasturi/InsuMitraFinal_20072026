import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  async getKpis(tenantId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalContacts,
      activePolicies,
      openClaims,
      openLeads,
      newContactsThisMonth,
      monthlyPremium,
      pendingTasks,
      upcomingRenewals,
    ] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId, isActive: true } }),

      this.prisma.policy.count({ where: { tenantId, status: 'ACTIVE' } }),

      this.prisma.claim.count({ where: { tenantId, status: { notIn: ['SETTLED', 'REJECTED'] } } }),

      this.prisma.productInterest.count({ where: { tenantId } }),

      this.prisma.contact.count({
        where: { tenantId, isActive: true, createdAt: { gte: startOfMonth } },
      }),

      this.prisma.policyPayment.aggregate({
        where: { isPaid: true, paidDate: { gte: startOfMonth }, policy: { tenantId } },
        _sum: { amount: true },
      }),

      this.prisma.employeeTask.count({
        where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),

      this.prisma.policy.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          endDate: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      data: {
        totalContacts,
        activePolicies,
        openClaims,
        openLeads,
        newContactsThisMonth,
        monthlyPremium: Number(monthlyPremium._sum?.amount ?? 0),
        pendingTasks,
        upcomingRenewals,
      },
    };
  }

  // ─── Monthly Revenue ────────────────────────────────────────────────────────
  async getMonthlyRevenue(tenantId: string, months = 12) {
    const results: { month: string; revenue: number }[] = [];
    const now = new Date();

    const payments = await this.prisma.policyPayment.findMany({
      where: {
        isPaid:   true,
        paidDate: { gte: new Date(now.getFullYear(), now.getMonth() - (months - 1), 1) },
        policy:   { tenantId },
      },
      select: { paidDate: true, amount: true },
    });

    // Group by month in-memory
    const map = new Map<string, number>();
    for (const p of payments) {
      if (!p.paidDate) continue;
      const key = `${p.paidDate.getFullYear()}-${String(p.paidDate.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) ?? 0) + Number(p.amount));
    }

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      results.push({ month: key, revenue: map.get(key) ?? 0 });
    }

    return { data: results };
  }

  // ─── Policy Portfolio (by product & insurance company) ─────────────────────
  async getPolicyPortfolio(tenantId: string) {
    const policies = await this.prisma.policy.findMany({
      where:  { tenantId, status: 'ACTIVE' },
      select: {
        plan: {
          select: {
            category: true,
            company:  { select: { name: true } },
          },
        },
      },
    });

    const productMap = new Map<string, number>();
    const companyMap = new Map<string, number>();

    for (const p of policies) {
      const cat  = p.plan?.category  || 'General';
      const comp = p.plan?.company?.name || 'Unknown';
      productMap.set(cat,  (productMap.get(cat)  ?? 0) + 1);
      companyMap.set(comp, (companyMap.get(comp) ?? 0) + 1);
    }

    return {
      data: {
        byProduct: Array.from(productMap.entries()).map(([name, value]) => ({ name, value })),
        byCompany: Array.from(companyMap.entries()).map(([name, value]) => ({ name, value })),
      },
    };
  }

  // ─── Lead Pipeline — groupBy not supported on MongoDB; use findMany + in-memory ─
  async getLeadPipeline(tenantId: string) {
    const rows = await this.prisma.productInterest.findMany({
      where:  { tenantId },
      select: { stage: true },
    });

    const counts = new Map<string, number>();
    for (const r of rows) {
      counts.set(r.stage, (counts.get(r.stage) ?? 0) + 1);
    }

    return {
      data: Array.from(counts.entries()).map(([stage, count]) => ({ stage, count })),
    };
  }

  // ─── Upcoming Events (next 7 days) ─────────────────────────────────────────
  async getUpcomingEvents(tenantId: string) {
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const events = await this.prisma.calendarEvent.findMany({
      where:   { tenantId, startAt: { gte: now, lte: end } },
      orderBy: { startAt: 'asc' },
      take:    10,
    });
    return { data: events };
  }

  // ─── Claim Summary — groupBy not supported on MongoDB; use findMany + in-memory ─
  async getClaimSummary(tenantId: string) {
    const rows = await this.prisma.claim.findMany({
      where:  { tenantId },
      select: { status: true, claimAmount: true },
    });

    const statusMap = new Map<string, { count: number; total: number }>();
    for (const r of rows) {
      const entry = statusMap.get(r.status) ?? { count: 0, total: 0 };
      entry.count++;
      entry.total += Number(r.claimAmount ?? 0);
      statusMap.set(r.status, entry);
    }

    return {
      data: Array.from(statusMap.entries()).map(([status, { count, total }]) => ({
        status,
        count,
        totalAmount: total,
      })),
    };
  }

  // ─── Database Summary — groupBy not supported on MongoDB; use findMany + in-memory ─
  async getDbSummary(tenantId: string) {
    const groupByStatus = <T extends { status: string }>(arr: T[]) => {
      const map = new Map<string, number>();
      for (const item of arr) map.set(item.status, (map.get(item.status) ?? 0) + 1);
      return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
    };

    const [policies, contacts, claims, leads, tasks] = await Promise.all([
      this.prisma.policy.findMany({
        where:  { tenantId, deletedAt: null },
        select: { status: true },
      }),
      this.prisma.contact.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.claim.findMany({
        where:  { tenantId, deletedAt: null },
        select: { status: true },
      }),
      this.prisma.productInterest.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.employeeTask.findMany({
        where:  { tenantId, deletedAt: null },
        select: { status: true },
      }),
    ]);

    return {
      data: {
        policies: groupByStatus(policies),
        contacts,
        claims:   groupByStatus(claims),
        leads,
        tasks:    groupByStatus(tasks),
      },
    };
  }
}
