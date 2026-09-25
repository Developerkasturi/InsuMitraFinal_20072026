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
        include: { 
          _count: { select: { plans: true } },
          plans: { where: { isActive: true }, orderBy: { name: 'asc' } },
        },
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

    // Auto-generate planCode if missing
    const prefix = (company.shortCode || company.name.substring(0, 4)).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanName = (dto.name || 'PLAN').toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 15);
    const planCode = dto.planCode || `${prefix}-${cleanName}-${Date.now().toString().slice(-4)}`;

    const existing = await this.prisma.insurancePlan.findUnique({
      where: { tenantId_planCode_companyId: { tenantId, planCode, companyId: dto.companyId } },
    });
    const finalPlanCode = existing ? `${planCode}-${Math.floor(1000 + Math.random() * 9000)}` : planCode;

    const plan = await this.prisma.insurancePlan.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        name: dto.name,
        planCode: finalPlanCode,
        category: dto.category ? String(dto.category).toUpperCase() : 'LIFE',
        subCategory: dto.subCategory || null,
        description: dto.description || null,
        minSumAssured: dto.minSumAssured != null && dto.minSumAssured !== '' ? Number(dto.minSumAssured) : null,
        maxSumAssured: dto.maxSumAssured != null && dto.maxSumAssured !== '' ? Number(dto.maxSumAssured) : null,
        minAge: dto.minAge != null && dto.minAge !== '' ? Number(dto.minAge) : null,
        maxAge: dto.maxAge != null && dto.maxAge !== '' ? Number(dto.maxAge) : null,
        hasPhcBenefit: Boolean(dto.hasPhcBenefit),
        phcAmount: dto.phcAmount != null && dto.phcAmount !== '' ? Number(dto.phcAmount) : null,
        phcCount: dto.phcCount != null && dto.phcCount !== '' ? Number(dto.phcCount) : null,
        isActive: dto.isActive !== false,
      },
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

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.planCode !== undefined) updateData.planCode = dto.planCode;
    if (dto.category !== undefined) updateData.category = String(dto.category).toUpperCase();
    if (dto.subCategory !== undefined) updateData.subCategory = dto.subCategory;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.minSumAssured !== undefined) updateData.minSumAssured = dto.minSumAssured != null && dto.minSumAssured !== '' ? Number(dto.minSumAssured) : null;
    if (dto.maxSumAssured !== undefined) updateData.maxSumAssured = dto.maxSumAssured != null && dto.maxSumAssured !== '' ? Number(dto.maxSumAssured) : null;
    if (dto.minAge !== undefined) updateData.minAge = dto.minAge != null && dto.minAge !== '' ? Number(dto.minAge) : null;
    if (dto.maxAge !== undefined) updateData.maxAge = dto.maxAge != null && dto.maxAge !== '' ? Number(dto.maxAge) : null;
    if (dto.hasPhcBenefit !== undefined) updateData.hasPhcBenefit = Boolean(dto.hasPhcBenefit);
    if (dto.phcAmount !== undefined) updateData.phcAmount = dto.phcAmount != null && dto.phcAmount !== '' ? Number(dto.phcAmount) : null;
    if (dto.phcCount !== undefined) updateData.phcCount = dto.phcCount != null && dto.phcCount !== '' ? Number(dto.phcCount) : null;
    if (dto.isActive !== undefined) updateData.isActive = Boolean(dto.isActive);

    const updated = await this.prisma.insurancePlan.update({
      where: { id },
      data:  updateData,
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

  // ─────────────────────────────────────────────────────────────────────────
  // Hospitals & Doctors
  // ─────────────────────────────────────────────────────────────────────────

  async listHospitals(tenantId: string) {
    const data = await this.prisma.hospital.findMany({
      where: { tenantId },
      include: { doctors: true },
      orderBy: { name: 'asc' },
    });
    return { data };
  }

  async createHospital(tenantId: string, dto: any) {
    const { doctors, ...hospitalData } = dto;
    
    const data = await this.prisma.hospital.create({
      data: {
        tenantId,
        name: hospitalData.name,
        city: hospitalData.city,
        state: hospitalData.state || null,
        address: hospitalData.address,
        phone: hospitalData.phone || hospitalData.contactNo,
        email: hospitalData.email || null,
        registrationNo: hospitalData.registrationNo || null,
        pincode: hospitalData.pincode,
        type: hospitalData.type,
        claimsPerson1Name: hospitalData.claimsPerson1Name,
        claimsPerson1Contact: hospitalData.claimsPerson1Contact,
        claimsPerson2Name: hospitalData.claimsPerson2Name,
        claimsPerson2Contact: hospitalData.claimsPerson2Contact,
        comment: hospitalData.comment,
        doctors: {
          create: (doctors || []).map((doc: any) => ({
            name: doc.name,
            degree: doc.degree,
            specialty: doc.speciality || doc.specialty,
            phone: doc.contactNo || doc.phone,
            email: doc.email || null,
          })),
        },
      },
      include: { doctors: true },
    });

    return { data };
  }

  async updateHospital(tenantId: string, id: string, dto: any) {
    const hospital = await this.prisma.hospital.findFirst({
      where: { id, tenantId },
    });
    if (!hospital) throw new NotFoundException('Hospital not found');

    const { doctors, ...hospitalData } = dto;

    if (doctors && Array.isArray(doctors)) {
      await this.prisma.doctor.deleteMany({
        where: { hospitalId: id },
      });
    }

    const data = await this.prisma.hospital.update({
      where: { id },
      data: {
        name: hospitalData.name,
        city: hospitalData.city,
        state: hospitalData.state || null,
        address: hospitalData.address,
        phone: hospitalData.phone || hospitalData.contactNo,
        email: hospitalData.email || null,
        registrationNo: hospitalData.registrationNo || null,
        pincode: hospitalData.pincode,
        type: hospitalData.type,
        claimsPerson1Name: hospitalData.claimsPerson1Name,
        claimsPerson1Contact: hospitalData.claimsPerson1Contact,
        claimsPerson2Name: hospitalData.claimsPerson2Name,
        claimsPerson2Contact: hospitalData.claimsPerson2Contact,
        comment: hospitalData.comment,
        ...(doctors && Array.isArray(doctors)
          ? {
              doctors: {
                create: doctors.map((doc: any) => ({
                  name: doc.name,
                  degree: doc.degree,
                  specialty: doc.speciality || doc.specialty,
                  phone: doc.contactNo || doc.phone,
                  email: doc.email || null,
                })),
              },
            }
          : {}),
      },
      include: { doctors: true },
    });

    return { data };
  }

  async removeHospital(tenantId: string, id: string) {
    const hospital = await this.prisma.hospital.findFirst({
      where: { id, tenantId },
    });
    if (!hospital) throw new NotFoundException('Hospital not found');

    await this.prisma.hospital.delete({
      where: { id },
    });

    return { message: 'Hospital and associated doctors deleted' };
  }

  async getCompulsoryRules(tenantId: string) {
    const rules = await this.prisma.compulsoryFieldRule.findMany({
      where: { tenantId },
    });
    return { data: rules };
  }

  async updateCompulsoryRules(tenantId: string, rules: { module: string; fieldKey: string; required: boolean }[]) {
    const results: any[] = [];
    for (const r of rules) {
      const res = await this.prisma.compulsoryFieldRule.upsert({
        where: {
          tenantId_module_fieldKey: {
            tenantId,
            module: r.module,
            fieldKey: r.fieldKey,
          },
        },
        create: {
          tenantId,
          module: r.module,
          fieldKey: r.fieldKey,
          required: r.required,
        },
        update: {
          required: r.required,
        },
      });
      results.push(res);
    }
    return { data: results };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Table Column Visibility
  // ─────────────────────────────────────────────────────────────────────────

  async getTableColumnVisibility(tenantId: string) {
    const rules = await this.prisma.tableColumnVisibility.findMany({
      where: { tenantId },
    });
    return { data: rules };
  }

  async updateTableColumnVisibility(tenantId: string, pageId: string, colName: string, isHidden: boolean) {
    const res = await this.prisma.tableColumnVisibility.upsert({
         where: {
            tenantId_pageId_colName: {
               tenantId,
               pageId,
               colName
            }
         },
         create: {
            tenantId,
            pageId,
            colName,
            isHidden
         },
         update: {
            isHidden
         }
    });
    return { data: res };
  }
}
