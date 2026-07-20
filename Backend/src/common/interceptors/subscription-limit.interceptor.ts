import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionStatus, UserRole } from '@prisma/client';

@Injectable()
export class SubscriptionLimitInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler) {
    const request = ctx.switchToHttp().getRequest();
    const { user, method } = request;

    // Only intercept POST / creation requests
    if (method === 'POST' && user && user.tenantId) {
      const tenantId = user.tenantId;
      const path = request.url;

      // 1. Fetch active subscription
      const sub = await this.prisma.subscription.findFirst({
        where: {
          tenantId,
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
        },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });

      const plan = sub?.plan;
      const planName = plan?.name || 'Free';

      // Default limits for Free plan (if no subscription exists)
      let maxContacts = 100;
      let maxUsers = 1;

      if (plan) {
        maxContacts = plan.maxContacts;
        maxUsers = plan.maxUsers;
      }

      // Check contacts limit
      if (path.includes('/contacts')) {
        // Count active contacts (filtering out soft deleted ones)
        const count = await this.prisma.contact.count({
          where: { tenantId, deletedAt: null },
        });
        if (maxContacts !== -1 && count >= maxContacts) {
          throw new ForbiddenException(
            `You have reached the contact limit (${maxContacts}) for the ${planName} plan. Please upgrade to add more.`,
          );
        }
      }

      // Check employees/users limit.
      // Only EMPLOYEE-role users count against the seat limit.
      // The OWNER account is always present and does NOT consume an employee seat.
      if (path.includes('/employees')) {
        const count = await this.prisma.user.count({
          where: {
            tenantId,
            isActive: true,
            role: UserRole.EMPLOYEE, // exclude OWNER and CONTACT roles from seat count
          },
        });
        if (maxUsers !== -1 && count >= maxUsers) {
          throw new ForbiddenException(
            `You have reached the employee seat limit (${maxUsers}) for the ${planName} plan. Please upgrade to add more.`,
          );
        }
      }
    }

    return next.handle();
  }
}
