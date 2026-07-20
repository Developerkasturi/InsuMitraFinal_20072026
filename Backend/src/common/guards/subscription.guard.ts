import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

export const REQUIRE_FEATURE_KEY = 'requireFeature';
export const RequireFeature = (feature: string) => SetMetadata(REQUIRE_FEATURE_KEY, feature);

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      REQUIRE_FEATURE_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // If no specific feature is required, allow access
    if (!requiredFeature) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest();
    const { user } = request;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role === 'SUPERADMIN') {
      return true;
    }

    if (!user.tenantId) {
      throw new ForbiddenException('Tenant identification required');
    }

    const tenantId = user.tenantId;

    // Fetch active/trial subscription
    const sub = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const planName = sub?.plan?.name || 'Free';

    // Explicit PDF-aligned feature check (Page 14)
    const isFeatureAllowed = (plan: string, feature: string): boolean => {
      // 1. Free features (Workspace, Contacts, Policies, Claims, Calendar)
      const freeFeatures = ['contacts', 'policies', 'claims', 'calendar', 'workspace'];
      if (freeFeatures.includes(feature)) return true;

      // 2. Starter features (Dashboard, Leads, Operations/Documents)
      const starterFeatures = [...freeFeatures, 'dashboard', 'leads', 'documents', 'operations'];
      if (plan === 'Starter') {
        return starterFeatures.includes(feature);
      }

      // 3. Growth features (Employees, Commissions, Firm Profile/Branding)
      const growthFeatures = [...starterFeatures, 'employees', 'commissions', 'branding'];
      if (plan === 'Growth') {
        return growthFeatures.includes(feature);
      }

      // 4. Enterprise features (All features including WhatsApp)
      if (plan === 'Enterprise' || plan === 'Business') {
        return true;
      }

      return false;
    };

    if (!isFeatureAllowed(planName, requiredFeature)) {
      throw new ForbiddenException(
        `The feature '${requiredFeature}' is not available on the ${planName} plan. Please upgrade.`,
      );
    }

    return true;

  }
}
