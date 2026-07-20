// ─────────────────────────────────────────────────────────────────────────────
// Tenant Guard
// Ensures the request is scoped to a valid tenantId.
// Must be applied AFTER JwtAuthGuard (relies on req.user populated by JWT strategy).
//
// Two accepted sources:
//   1. JWT payload  — req.user.tenantId  (regular user login)
//   2. Header       — X-Tenant-ID        (public API calls with explicit header)
// ─────────────────────────────────────────────────────────────────────────────
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/roles.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Skip on @Public() routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const tenantId: string | undefined =
      req.user?.tenantId ?? req.headers['x-tenant-id'];

    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    // Normalise — downstream services use req.tenantId
    req.tenantId = tenantId;
    return true;
  }
}
