// ─────────────────────────────────────────────────────────────────────────────
// Commissions Service — multi-stakeholder splits, yearly schedules
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCommissionDto, UpdateCommissionDto, CreateCommissionYearDto } from './dto/commission.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, userId: string, role: UserRole, query: any) {
    const page  = Math.max(1, parseInt(String(query.page  ?? 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? 20), 10) || 20));
    const { yearId, beneficiaryId, isPaid } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (yearId)        where.commissionYearId = yearId;
    if (role === UserRole.EMPLOYEE) {
      where.beneficiaryId = userId;
    } else if (beneficiaryId) {
      where.beneficiaryId = beneficiaryId;
    }
    if (isPaid !== undefined) where.isPaid     = isPaid === 'true';

    const [data, total] = await Promise.all([
      this.prisma.commission.findMany({
        where,
        skip,
        take:    limit,
        include: {
          policy:         { select: { policyNumber: true } },
          commissionYear: { select: { name: true, year: true } },
          beneficiary:    { select: { employeeProfile: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.commission.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getOverview(tenantId: string, userId: string, role: UserRole) {
    const where: any = { tenantId };
    if (role === UserRole.EMPLOYEE) {
      where.beneficiaryId = userId;
    }
    const [total, paid, pending] = await Promise.all([
      this.prisma.commission.aggregate({ where, _sum: { amount: true }, _count: true }),
      this.prisma.commission.aggregate({ where: { ...where, isPaid: true  }, _sum: { amount: true } }),
      this.prisma.commission.aggregate({ where: { ...where, isPaid: false }, _sum: { amount: true } }),
    ]);
    return {
      data: {
        totalAmount:   Number(total._sum.amount   ?? 0),
        paidAmount:    Number(paid._sum.amount     ?? 0),
        pendingAmount: Number(pending._sum.amount  ?? 0),
        count:         total._count,
      },
    };
  }

  async create(tenantId: string, dto: CreateCommissionDto) {
    const commission = await this.prisma.commission.create({
      data: {
        tenantId,
        policyId:         dto.policyId,
        commissionYearId: dto.commissionYearId,
        beneficiaryId:    dto.beneficiaryId,
        amount:           dto.amount,
        rate:             dto.rate,
        notes:            dto.notes,
        // Detailed Splits
        basePremium:          dto.basePremium,
        baseCommissionRate:   dto.baseCommissionRate,
        baseCommissionAmount: dto.baseCommissionAmount,
        addonPremium:          dto.addonPremium,
        addonCommissionRate:   dto.addonCommissionRate,
        addonCommissionAmount: dto.addonCommissionAmount,
        deductibleRate:        dto.deductibleRate,
        deductibleAmount:      dto.deductibleAmount,
        monthlyGridRate:       dto.monthlyGridRate,
        monthlyGridAmount:     dto.monthlyGridAmount,
        otherRate:             dto.otherRate,
        otherAmount:           dto.otherAmount,
        renewalRate:           dto.renewalRate,
        renewalAmount:         dto.renewalAmount,
        year1Commission:       dto.year1Commission,
        year2Commission:       dto.year2Commission,
        year3Commission:       dto.year3Commission,
        year4Commission:       dto.year4Commission,
        year5Commission:       dto.year5Commission,
      },
    });
    return { data: commission, message: 'Commission recorded' };
  }

  async markPaid(tenantId: string, id: string) {
    const commission = await this.prisma.commission.findFirst({ where: { id, tenantId } });
    if (!commission) throw new NotFoundException('Commission not found');

    const updated = await this.prisma.commission.update({
      where: { id },
      data:  { isPaid: true, paidAt: new Date() },
    });
    return { data: updated, message: 'Commission marked as paid' };
  }

  async remove(tenantId: string, id: string) {
    const commission = await this.prisma.commission.findFirst({ where: { id, tenantId } });
    if (!commission) throw new NotFoundException('Commission not found');
    await this.prisma.commission.delete({ where: { id } });
    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          entityType: 'Commission',
          entityId: id,
          action: 'DELETE',
          description: 'Admin directly deleted the commission',
        }
      });
    } catch (err: any) {
      console.warn(`ActivityLog write failed for commission delete: ${err.message}`);
    }
    return { data: null, message: 'Commission deleted' };
  }

  async getBySummary(tenantId: string, yearId: string) {
    // Aggregate commissions per employee for a year
    const commissions = await this.prisma.commission.findMany({
      where:   { tenantId, commissionYearId: yearId },
      include: { policy: { select: { policyNumber: true } } },
    });

    // Group by beneficiary
    const grouped = commissions.reduce((acc: any, c: any) => {
      if (!acc[c.beneficiaryId]) {
        acc[c.beneficiaryId] = { beneficiaryId: c.beneficiaryId, total: 0, paid: 0, pending: 0, count: 0 };
      }
      acc[c.beneficiaryId].total  += Number(c.amount);
      acc[c.beneficiaryId].count  += 1;
      if (c.isPaid) acc[c.beneficiaryId].paid    += Number(c.amount);
      else          acc[c.beneficiaryId].pending  += Number(c.amount);
      return acc;
    }, {});

    return { data: Object.values(grouped) };
  }

  // ── Commission Years ──────────────────────────────────────────────────────

  async listYears(tenantId: string) {
    const years = await this.prisma.commissionYear.findMany({
      where:   { tenantId },
      orderBy: { year: 'desc' },
    });
    return { data: years };
  }

  async createYear(tenantId: string, dto: { year: number; name: string }) {
    const year = await this.prisma.commissionYear.create({ data: { ...dto, tenantId } });
    return { data: year, message: 'Commission year created' };
  }
}
