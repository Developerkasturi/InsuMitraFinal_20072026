// ─────────────────────────────────────────────────────────────────────────────
// SuperAdmin Auth Service
// Handles platform-level admin authentication (separate from tenant users).
// ─────────────────────────────────────────────────────────────────────────────
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService }    from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { UserRole }      from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export class SuperAdminLoginDto {
  email:    string;
  password: string;
}

export class SuperAdminChangePasswordDto {
  currentPassword: string;
  newPassword:     string;
}

@Injectable()
export class SuperAdminAuthService {
  private readonly SALT = 12;

  constructor(
    private readonly prisma:  PrismaService,
    private readonly jwt:     JwtService,
    private readonly config:  ConfigService,
  ) {}

  // ── Login ──────────────────────────────────────────────────────────────────
  async login(dto: SuperAdminLoginDto) {
    const admin = await this.prisma.superAdmin.findUnique({
      where: { email: dto.email },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.superAdmin.update({
      where: { id: admin.id },
      data:  { lastLoginAt: new Date() },
    });

    return this.generateToken(admin);
  }

  // ── Get self ───────────────────────────────────────────────────────────────
  async getSelf(adminId: string) {
    const admin = await this.prisma.superAdmin.findUnique({
      where:  { id: adminId },
      select: { id: true, email: true, name: true, isActive: true, lastLoginAt: true, createdAt: true },
    });
    if (!admin) throw new UnauthorizedException('Not found');
    return { data: admin };
  }

  // ── Change password ────────────────────────────────────────────────────────
  async changePassword(adminId: string, dto: SuperAdminChangePasswordDto) {
    const admin = await this.prisma.superAdmin.findUnique({ where: { id: adminId } });
    if (!admin) throw new BadRequestException('Admin not found');

    const valid = await bcrypt.compare(dto.currentPassword, admin.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, this.SALT);
    await this.prisma.superAdmin.update({
      where: { id: adminId },
      data:  { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }

  // ── Platform overview ──────────────────────────────────────────────────────
  async getPlatformStats() {
    const [totalTenants, activeTenants, totalUsers, totalPolicies, totalContacts] =
      await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.tenant.count({ where: { isActive: true } }),
        this.prisma.user.count(),
        this.prisma.policy.count(),
        this.prisma.contact.count(),
      ]);

    return { data: { totalTenants, activeTenants, totalUsers, totalPolicies, totalContacts } };
  }

  // ── List tenants ──────────────────────────────────────────────────────────
  async listTenants(query: { page?: number; limit?: number; search?: string }) {
    const page  = Number(query.page  ?? 1);
    const limit = Number(query.limit ?? 20);
    const skip  = (page - 1) * limit;

    const where: any = query.search
      ? {
          OR: [
            { name:  { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { slug:  { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { users: true, policies: true, contacts: true } },
          subscriptions: {
            where:   { status: { in: ['ACTIVE', 'TRIAL'] } },
            include: { plan: true },
            take:    1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { data: tenants, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ── Create a new tenant + owner (SuperAdmin shortcut) ──────────────────────
  async createTenant(dto: {
    tenantName: string; tenantSlug: string;
    email: string; password: string;
    firstName: string; lastName: string; phone?: string;
  }) {
    const slugTaken = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
    if (slugTaken) throw new ConflictException('Tenant slug already taken');

    const emailTaken = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (emailTaken) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName, slug: dto.tenantSlug, email: dto.email },
      });

      const user = await tx.user.create({
        data: { tenantId: tenant.id, email: dto.email, passwordHash, role: UserRole.OWNER },
      });

      await tx.employeeProfile.create({
        data: { tenantId: tenant.id, userId: user.id, firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone || '' },
      });

      const plan = await tx.subscriptionPlan.findFirst({ orderBy: { priceMonthly: 'asc' } });
      if (plan) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + (plan.trialDays || 14));
        await tx.subscription.create({
          data: { tenantId: tenant.id, planId: plan.id, status: 'TRIAL', startDate: new Date(), endDate: trialEnd, trialEnd },
        });
      }

      return tenant;
    });

    return { message: 'Tenant created successfully', data: result };
  }

  // ── Toggle tenant active status ────────────────────────────────────────────
  async setTenantStatus(tenantId: string, isActive: boolean) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data:  { isActive },
    });
    return { message: `Tenant ${isActive ? 'activated' : 'deactivated'} successfully` };
  }

  // ── Update tenant details ──────────────────────────────────────────────────
  async updateTenant(tenantId: string, dto: { name?: string; email?: string; phone?: string }) {
    if (dto.email) {
      const conflict = await this.prisma.tenant.findFirst({
        where: { email: dto.email, NOT: { id: tenantId } },
      });
      if (conflict) throw new ConflictException('Email already in use by another tenant');
    }
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data:  { ...(dto.name && { name: dto.name }), ...(dto.email && { email: dto.email }), phone: dto.phone ?? null },
    });
    return { message: 'Tenant updated successfully', data: tenant };
  }

  // ── Delete tenant and all its data ────────────────────────────────────────
  async deleteTenant(tenantId: string) {
    await this.prisma.$transaction(async (tx) => {
      // delete leaf records first, then climb up to tenant
      await tx.notification.deleteMany({ where: { tenantId } });
      await tx.document.deleteMany({ where: { tenantId } });
      await tx.calendarEvent.deleteMany({ where: { tenantId } });
      await tx.commission.deleteMany({ where: { tenantId } });
      await tx.commissionYear.deleteMany({ where: { tenantId } });
      await tx.claim.deleteMany({ where: { tenantId } });
      await tx.policy.deleteMany({ where: { tenantId } });
      await tx.productInterest.deleteMany({ where: { tenantId } });
      await tx.insurancePlan.deleteMany({ where: { tenantId } });
      await tx.insuranceCompany.deleteMany({ where: { tenantId } });
      await tx.whatsappCampaign.deleteMany({ where: { tenantId } });
      await tx.whatsappTemplate.deleteMany({ where: { tenantId } });
      await tx.whatsappWallet.deleteMany({ where: { tenantId } });
      await tx.subscription.deleteMany({ where: { tenantId } });
      await tx.employeeProfile.deleteMany({ where: { tenantId } });
      await tx.contact.deleteMany({ where: { tenantId } });
      await tx.user.deleteMany({ where: { tenantId } });
      await tx.tenant.delete({ where: { id: tenantId } });
    });
    return { message: 'Tenant deleted successfully' };
  }

  // ── Subscription plan management ─────────────────────────────────────────

  async listSubscriptionPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: { priceMonthly: 'asc' },
    });
    return { data: plans };
  }

  async createSubscriptionPlan(dto: {
    name: string; description?: string;
    priceMonthly: number; priceYearly: number;
    maxContacts: number; maxUsers: number; maxPolicies?: number; trialDays?: number;
    features?: Record<string, any>;
  }) {
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name:         dto.name,
        description:  dto.description,
        priceMonthly: dto.priceMonthly,
        priceYearly:  dto.priceYearly,
        maxContacts:  dto.maxContacts,
        maxUsers:     dto.maxUsers,
        maxPolicies:  dto.maxPolicies ?? 9999,
        trialDays:    dto.trialDays ?? 14,
        features:     dto.features ?? {},
        isActive:     true,
      },
    });
    return { data: plan, message: 'Subscription plan created' };
  }

  async updateSubscriptionPlan(planId: string, dto: Partial<{
    name: string; description: string;
    priceMonthly: number; priceYearly: number;
    maxContacts: number; maxUsers: number; maxWhatsappMessages: number;
    trialDays: number; features: string[]; isActive: boolean;
  }>) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new BadRequestException('Plan not found');

    const updated = await this.prisma.subscriptionPlan.update({
      where: { id: planId },
      data:  dto as any,
    });
    return { data: updated, message: 'Plan updated' };
  }

  async deactivateSubscriptionPlan(planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new BadRequestException('Plan not found');

    await this.prisma.subscriptionPlan.update({
      where: { id: planId },
      data:  { isActive: false },
    });
    return { message: 'Plan deactivated' };
  }

  // ── Feature Feedback (platform-wide) ────────────────────────────────────
  async getAllFeedback(params: { page?: number; limit?: number }) {
    const take = Number(params.limit) || 50;
    const skip = ((Number(params.page) || 1) - 1) * take;
    const [items, total] = await Promise.all([
      this.prisma.featureFeedback.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: { tenant: { select: { name: true, slug: true } } },
      }),
      this.prisma.featureFeedback.count(),
    ]);
    return { data: items, meta: { total, page: Number(params.page) || 1, limit: take } };
  }

  // ── Private helpers ────────────────────────────────────────────────────────
  private async generateToken(admin: { id: string; email: string; name: string }) {
    const payload = { sub: admin.id, email: admin.email, type: 'superadmin' };

    const token = await this.jwt.signAsync(payload, {
      secret:    this.config.get<string>('jwt.superadminSecret'),
      expiresIn: this.config.get<string>('jwt.expiresIn', '7d'),
    });

    return { data: { accessToken: token, expiresIn: '7d', admin: { id: admin.id, email: admin.email, name: admin.name } } };
  }
}
