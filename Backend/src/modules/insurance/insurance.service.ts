import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class InsuranceService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Insurance Companies
  // ─────────────────────────────────────────────────────────────────────────

  async listCompanies(tenantId: string, query: any) {
    const { page = '1', limit = '50', search, active } = query;
    const pageNum  = Math.max(1, parseInt(page,  10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { tenantId };
    if (active !== undefined) where.isActive = active === 'true';
    if (search) {
      where.OR = [
        { name:      { contains: search, mode: 'insensitive' } },
        { shortCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.insuranceCompany.findMany({
        where,
        skip,
        take:    limitNum,
        orderBy: { name: 'asc' },
        include: { _count: { select: { plans: true } } },
      }),
      this.prisma.insuranceCompany.count({ where }),
    ]);

    return { data, meta: { total, page: pageNum, limit: limitNum } };
  }

  async getCompany(tenantId: string, id: string) {
    const company = await this.prisma.insuranceCompany.findFirst({
      where:   { id, tenantId },
      include: { plans: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    });
    if (!company) throw new NotFoundException('Insurance company not found');
    return { data: company };
  }

  async createCompany(tenantId: string, dto: any) {
    const existing = await this.prisma.insuranceCompany.findUnique({
      where: { tenantId_shortCode: { tenantId, shortCode: dto.shortCode } },
    });
    if (existing) throw new BadRequestException('Short code already exists');

    const company = await this.prisma.insuranceCompany.create({
      data: { tenantId, ...dto },
    });
    return { data: company };
  }

  async updateCompany(tenantId: string, id: string, dto: any) {
    await this.getCompany(tenantId, id); // throws 404 if not found

    if (dto.shortCode) {
      const conflict = await this.prisma.insuranceCompany.findFirst({
        where: { tenantId, shortCode: dto.shortCode, id: { not: id } },
      });
      if (conflict) throw new BadRequestException('Short code already in use');
    }

    const updated = await this.prisma.insuranceCompany.update({
      where: { id },
      data:  dto,
    });
    return { data: updated };
  }

  async removeCompany(tenantId: string, id: string) {
    await this.getCompany(tenantId, id);
    await this.prisma.insuranceCompany.update({
      where: { id },
      data:  { isActive: false },
    });
    return { message: 'Insurance company deactivated' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Insurance Plans
  // ─────────────────────────────────────────────────────────────────────────

  async listPlans(tenantId: string, query: any) {
    const { page = '1', limit = '50', search, companyId, category, active } = query;
    const pageNum  = Math.max(1, parseInt(page,  10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { tenantId };
    if (active     !== undefined) where.isActive  = active === 'true';
    if (companyId)                where.companyId = companyId;
    if (category)                 where.category  = category;
    if (search) {
      where.OR = [
        { name:     { contains: search, mode: 'insensitive' } },
        { planCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.insurancePlan.findMany({
        where,
        skip,
        take:    limitNum,
        orderBy: [{ company: { name: 'asc' } }, { name: 'asc' }],
        include: { company: { select: { name: true, shortCode: true, logoUrl: true } } },
      }),
      this.prisma.insurancePlan.count({ where }),
    ]);

    return { data, meta: { total, page: pageNum, limit: limitNum } };
  }

  async getPlan(tenantId: string, id: string) {
    const plan = await this.prisma.insurancePlan.findFirst({
      where:   { id, tenantId },
      include: { company: true },
    });
    if (!plan) throw new NotFoundException('Insurance plan not found');
    return { data: plan };
  }

  async createPlan(tenantId: string, dto: any) {
    // Validate company belongs to tenant
    const company = await this.prisma.insuranceCompany.findFirst({
      where: { id: dto.companyId, tenantId, isActive: true },
    });
    if (!company) throw new NotFoundException('Insurance company not found');

    const existing = await this.prisma.insurancePlan.findUnique({
      where: { tenantId_planCode_companyId: { tenantId, planCode: dto.planCode, companyId: dto.companyId } },
    });
    if (existing) throw new BadRequestException('Plan code already exists for this company');

    const plan = await this.prisma.insurancePlan.create({
      data:    { tenantId, ...dto },
      include: { company: { select: { name: true, shortCode: true } } },
    });
    return { data: plan };
  }

  async updatePlan(tenantId: string, id: string, dto: any) {
    await this.getPlan(tenantId, id);

    if (dto.planCode) {
      const companyId = dto.companyId ?? (await this.prisma.insurancePlan.findUnique({ where: { id } }))!.companyId;
      const conflict = await this.prisma.insurancePlan.findFirst({
        where: { tenantId, planCode: dto.planCode, companyId, id: { not: id } },
      });
      if (conflict) throw new BadRequestException('Plan code already in use for this company');
    }

    const updated = await this.prisma.insurancePlan.update({
      where: { id },
      data:  dto,
    });
    return { data: updated };
  }

  async removePlan(tenantId: string, id: string) {
    await this.getPlan(tenantId, id);
    await this.prisma.insurancePlan.update({
      where: { id },
      data:  { isActive: false },
    });
    return { message: 'Insurance plan deactivated' };
  }
}
