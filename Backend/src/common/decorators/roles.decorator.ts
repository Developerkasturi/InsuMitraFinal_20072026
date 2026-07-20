// ─────────────────────────────────────────────────────────────────────────────
// RBAC Decorators
// ─────────────────────────────────────────────────────────────────────────────
import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';

// ── Metadata keys ─────────────────────────────────────────────────────────
export const ROLES_KEY              = 'roles';
export const IS_PUBLIC_KEY          = 'isPublic';
/** Set on routes where EMPLOYEE access must be scoped to their own records */
export const IS_EMPLOYEE_SCOPED_KEY = 'isEmployeeScoped';

// ── Route-level decorators ────────────────────────────────────────────────

/** Mark a route or controller as public (skips JwtAuthGuard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Declare the minimum role(s) required for a route.
 * The RbacGuard checks role hierarchy: SUPERADMIN > OWNER > EMPLOYEE > CONTACT.
 * Passing OWNER means both OWNER and SUPERADMIN are allowed.
 *
 * Usage: @Roles(UserRole.OWNER)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Mark a route as employee-scoped.
 * When combined with EmployeeScopeGuard this ensures that:
 *   - EMPLOYEE users can only access records where assignedEmployeeId = currentUser.id
 *   - OWNER / SUPERADMIN are unrestricted
 *
 * The guard attaches req.employeeFilter (a Prisma WHERE fragment) for services.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, EmployeeScopeGuard)
 *   @EmployeeScoped()
 *   @Get()
 *   findAll() { … }
 */
export const EmployeeScoped = () => SetMetadata(IS_EMPLOYEE_SCOPED_KEY, true);

// ── Parameter decorators ──────────────────────────────────────────────────

/**
 * Injects the authenticated user from the JWT payload into a controller param.
 * Usage: @CurrentUser() user: ScopedUser
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * Injects the Prisma WHERE fragment set by EmployeeScopeGuard.
 * Usage: @EmployeeFilter() filter: { assignedEmployeeId?: string }
 */
export const EmployeeFilter = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // Default to empty object if guard wasn't applied (unrestricted)
    return (request['employeeFilter'] as { assignedEmployeeId?: string }) ?? {};
  },
);

// ── Convenience re-export ─────────────────────────────────────────────────
export { UserRole };
