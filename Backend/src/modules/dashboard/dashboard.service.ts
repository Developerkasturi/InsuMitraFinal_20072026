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

      this.prisma.productInterest.count({
        where: { tenantId },
      }),

      this.prisma.contact.count({
        where: { tenantId, isActive: true, createdAt: { gte: startOfMonth } },
      }),

      this.prisma.policyPayment.aggregate({
        where: { isPaid: true, paidDate: { gte: startOfMonth }, policy: { tenantId } },
        _sum: { amount: true },
      }),

      this.prisma.employeeTask.count({ where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),

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
        paidDate: {
          gte: new Date(now.getFullYear(), now.getMonth() - (months - 1), 1),
        },
        policy:   { tenantId },
      },
      select: { paidDate: true, amount: true },
    });

    // Group by month
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

  // ─── Policy Portfolio (by product & insurance company) ───────────────────────────
  async getPolicyPortfolio(tenantId: string) {
    const policies = await this.prisma.policy.findMany({
      where:   { tenantId, status: 'ACTIVE' },
      include: {
        plan: {
          include: {
            company: { select: { name: true } }
          }
        }
      },
    });

    const productMap = new Map<string, number>();
    const companyMap = new Map<string, number>();

    for (const p of policies) {
      const cat = p.plan?.category || 'General';
      productMap.set(cat, (productMap.get(cat) ?? 0) + 1);

      const comp = p.plan?.company?.name || 'Unknown';
      companyMap.set(comp, (companyMap.get(comp) ?? 0) + 1);
    }

    return {
      data: {
        byProduct: Array.from(productMap.entries()).map(([name, value]) => ({ name, value })),
        byCompany: Array.from(companyMap.entries()).map(([name, value]) => ({ name, value })),
      }
    };
  }

  // ─── Lead Pipeline ─────────────────────────────────────────────────────────
  async getLeadPipeline(tenantId: string) {
    const rows = await this.prisma.productInterest.groupBy({
      by: ['stage'],
      where: { tenantId },
      _count: true,
    });
    return { data: rows.map(r => ({ stage: r.stage, count: r._count })) };
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

  // ─── Claim Summary ─────────────────────────────────────────────────────────
  async getClaimSummary(tenantId: string) {
    const rows = await this.prisma.claim.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true,
      _sum: { claimAmount: true },
    });
    return {
      data: rows.map(r => ({
        status:       r.status,
        count:        r._count,
        totalAmount:  Number(r._sum.claimAmount ?? 0),
      })),
    };
  }

  // ─── Database Summary ────────────────────────────────────────────────────────
  async getDbSummary(tenantId: string) {
    const [
      policiesGrouped,
      contactsCount,
      claimsGrouped,
      leadsCount,
      tasksGrouped
    ] = await Promise.all([
      this.prisma.policy.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: true,
      }),
      this.prisma.contact.count({
        where: { tenantId, deletedAt: null }
      }),
      this.prisma.claim.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: true,
      }),
      this.prisma.productInterest.count({
        where: { tenantId, deletedAt: null }
      }),
      this.prisma.employeeTask.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: true,
      })
    ]);

    return {
      data: {
        policies: policiesGrouped.map(p => ({ status: p.status, count: p._count })),
        contacts: contactsCount,
        claims: claimsGrouped.map(c => ({ status: c.status, count: c._count })),
        leads: leadsCount,
        tasks: tasksGrouped.map(t => ({ status: t.status, count: t._count })),
      }
    };
  }
}

