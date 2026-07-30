import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List all public plans ─────────────────────────────────────────────────
  async listPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where:   { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });
    return { data: plans };
  }

  // ─── Current tenant subscription ──────────────────────────────────────────
  async getCurrent(tenantId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where:   { tenantId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) throw new NotFoundException('No active subscription found');
    return { data: sub };
  }

  // ─── Check if a feature is within the tenant's limits ─────────────────────
  async checkLimit(tenantId: string, resource: 'contacts' | 'employees' | 'whatsapp') {
    const sub = await this.prisma.subscription.findFirst({
      where:   { tenantId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('No active subscription');

    const plan = sub.plan as any;
    let current: number;
    let limit: number;

    if (resource === 'contacts') {
      current = await this.prisma.contact.count({ where: { tenantId, isActive: true } });
      limit   = plan.maxContacts ?? Infinity;
    } else if (resource === 'employees') {
      current = await this.prisma.user.count({ where: { tenantId, isActive: true } });
      limit   = plan.maxUsers ?? Infinity;
    } else {
      const wallet = await this.prisma.whatsappWallet.findFirst({ where: { tenantId } });
      const planFeatures = (plan.features as any) ?? {};
      const planLimit = planFeatures.monthlyWhatsappCredits ?? planFeatures.maxWhatsappMessages ?? null;
      return { data: { creditsLeft: Number(wallet?.balance ?? 0), limit: planLimit } };
    }

    return { data: { current, limit, withinLimit: current < limit } };
  }

  // ─── Upgrade plan ─────────────────────────────────────────────────────────
  async upgrade(tenantId: string, planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Plan not found');

    // Expire current active subscription
    await this.prisma.subscription.updateMany({
      where:  { tenantId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
      data:   { status: SubscriptionStatus.CANCELLED },
    });

    const startDate = new Date();
    const endDate   = new Date();
    endDate.setDate(endDate.getDate() + (plan.trialDays ?? 30));

    const newSub = await this.prisma.subscription.create({
      data: {
        tenantId,
        planId:    plan.id,
        status:    SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
      },
      include: { plan: true },
    });

    return { data: newSub, message: `Upgraded to ${plan.name} successfully` };
  }

  // ─── Cancel subscription ───────────────────────────────────────────────────
  async cancel(tenantId: string) {
    const result = await this.prisma.subscription.updateMany({
      where: { tenantId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
      data:  { status: SubscriptionStatus.CANCELLED },
    });
    if (!result.count) throw new BadRequestException('No active subscription to cancel');
    return { message: 'Subscription cancelled' };
  }

  // ─── Billing history ───────────────────────────────────────────────────────
  async getBillingHistory(tenantId: string) {
    const payments = await this.prisma.subscriptionPayment.findMany({
      where:   { subscription: { tenantId } },
      include: { subscription: { include: { plan: true } } },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });
    return { data: payments };
  }
}
