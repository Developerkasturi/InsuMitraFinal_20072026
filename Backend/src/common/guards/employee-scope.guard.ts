// ─────────────────────────────────────────────────────────────────────────────
// Employee Scope Guard
//
// Enforces that EMPLOYEE users can only operate on records assigned to them.
// Must be placed AFTER JwtAuthGuard so that req.user is already populated.
//
// What this guard does:
//   1. Reads @EmployeeScoped() metadata from the route / controller.
//   2. For EMPLOYEE users it:
//        a. Attaches req.employeeFilter = { assignedEmployeeId: user.id }
//           so downstream services can spread it into their Prisma WHERE clause.
//        b. (Optional) Validates any `assignedEmployeeId` query-param / body field
//           against the authenticated user's id, rejecting mismatches early.
//   3. For OWNER / SUPERADMIN it sets req.employeeFilter = {} (unrestricted).
//
// Usage:
//   @UseGuards(JwtAuthGuard, EmployeeScopeGuard)
//   @EmployeeScoped()
//   @Get()
//   findAll(@CurrentUser() user: ScopedUser, @Req() req: Request) { … }
//
//   // In the service:
//   where: { tenantId: user.tenantId, ...req['employeeFilter'] }
// ─────────────────────────────────────────────────────────────────────────────

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole }  from '@prisma/client';
import { IS_EMPLOYEE_SCOPED_KEY } from '../decorators/roles.decorator';

@Injectable()
export class EmployeeScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Only runs on routes decorated with @EmployeeScoped()
    const isScoped = this.reflector.getAllAndOverride<boolean>(
      IS_EMPLOYEE_SCOPED_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;

    if (!isScoped) {
      // Route does not declare scoping — nothing to enforce
      return true;
    }

    if (!user) {
      // Should never reach here if JwtAuthGuard ran first
      throw new ForbiddenException('Authentication required');
    }

    if (user.role === UserRole.EMPLOYEE) {
      // Attach filter used by services in their Prisma WHERE clause
      req.employeeFilter = { assignedEmployeeId: user.id };

      // ── Param / body validation ───────────────────────────────────────
      // If the request explicitly names an assignedEmployeeId (in query-params
      // or JSON body), it must match the authenticated employee's own id.
      // This prevents an employee from crafting a request for another employee's
      // records even if a service accidentally skips the filter.
      const bodyId  = req.body?.assignedEmployeeId as string | undefined;
      const queryId = req.query?.assignedEmployeeId as string | undefined;
      const paramId = req.params?.employeeId as string | undefined;

      for (const provided of [bodyId, queryId, paramId]) {
        if (provided && provided !== user.id) {
          throw new ForbiddenException(
            'Employees may only access their own assigned records',
          );
        }
      }
    } else {
      // OWNER / SUPERADMIN — no restriction within the tenant
      req.employeeFilter = {};
    }

    return true;
  }
}
