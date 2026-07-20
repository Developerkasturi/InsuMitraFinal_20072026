// ─────────────────────────────────────────────────────────────────────────────
// RBAC Guard — enforces role-based access control on protected routes
// Must be used together with JwtAuthGuard.
//
// Hierarchy:  SUPERADMIN > OWNER > EMPLOYEE > CONTACT
// ─────────────────────────────────────────────────────────────────────────────
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/** Numeric privilege level — higher = more access */
const ROLE_LEVEL: Record<UserRole, number> = {
  [UserRole.SUPERADMIN]: 100,
  [UserRole.OWNER]:      80,
  [UserRole.EMPLOYEE]:   40,
  [UserRole.CONTACT]:    10,
};

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Retrieve required roles from metadata (set via @Roles() decorator)
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // If no @Roles() specified, allow any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Authentication required');

    const userLevel = ROLE_LEVEL[user.role as UserRole] ?? 0;

    // Check whether user has at least the minimum required privilege level
    const hasAccess = requiredRoles.some(
      (role) => userLevel >= ROLE_LEVEL[role],
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        `Role '${user.role}' is not allowed to access this resource`,
      );
    }

    return true;
  }
}
