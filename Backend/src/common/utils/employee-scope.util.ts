// ─────────────────────────────────────────────────────────────────────────────
// Employee Scope Utility
//
// Provides a Prisma WHERE clause fragment that restricts queries to records
// the current user is authorised to see.
//
// Policy:
//   SUPERADMIN  →  no restriction (cross-tenant admin)
//   OWNER       →  no restriction (full access within their tenant)
//   EMPLOYEE    →  restricted to records where assignedEmployeeId = user.id
//
// Usage in a service:
//   const records = await this.prisma.productInterest.findMany({
//     where: {
//       tenantId: user.tenantId,
//       ...employeeScopeWhere(user),
//     },
//   });
// ─────────────────────────────────────────────────────────────────────────────

import { UserRole } from '@prisma/client';

/** Minimal user shape required by scope helpers — comes from req.user (JWT payload) */
export interface ScopedUser {
  id:       string;
  email:    string;
  role:     string;   // UserRole but stored as string from JWT
  tenantId: string;
}

/**
 * Returns a Prisma WHERE fragment that enforces employee-level record ownership.
 *
 * - EMPLOYEE  → `{ assignedEmployeeId: user.id }`
 * - All other roles → `{}` (no additional filter)
 *
 * Designed for models that carry the `assignedEmployeeId` field:
 *   ProductInterest (leads), Policy, Claim
 */
export function employeeScopeWhere(
  user: ScopedUser,
): { assignedEmployeeId?: string } {
  if (user.role === UserRole.EMPLOYEE) {
    return { assignedEmployeeId: user.id };
  }
  return {};
}

/**
 * Convenience: returns true when the current user is not constrained,
 * i.e. OWNER or SUPERADMIN.  Useful for branching logic in services.
 */
export function isPrivilegedRole(user: ScopedUser): boolean {
  return (
    user.role === UserRole.OWNER ||
    user.role === UserRole.SUPERADMIN
  );
}

/**
 * Builds the base tenantId WHERE clause merged with the employee scope.
 * Combines the two most common conditions into one call.
 *
 * Example:
 *   where: tenantScopedWhere(user)
 *   // → { tenantId: 'xxx', assignedEmployeeId: 'yyy' }  for EMPLOYEE
 *   // → { tenantId: 'xxx' }                              for OWNER/SUPERADMIN
 */
export function tenantScopedWhere(
  user: ScopedUser,
): { tenantId: string; assignedEmployeeId?: string } {
  return {
    tenantId: user.tenantId,
    ...employeeScopeWhere(user),
  };
}
