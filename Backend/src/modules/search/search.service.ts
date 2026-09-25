import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';

export type SearchType = 'contacts' | 'policies' | 'claims' | 'leads' | 'employees' | 'operations' | 'all';

interface ContactRow {
  id: string;
  contact_id: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  alternate_phone: string | null;
  email: string | null;
  aadhaar_number: string | null;
  pan_number: string | null;
  avatar_url: string | null;
}

interface PolicyRow {
  id: string;
  policy_number: string;
  status: string;
  contact_id: string;
  contact_first: string;
  contact_last: string;
  contact_phone: string;
  plan_name: string | null;
  company_name: string | null;
}

interface ClaimRow {
  id: string;
  claim_number: string;
  status: string;
  claim_type: string;
  contact_id: string;
  contact_first: string;
  contact_last: string;
  contact_phone: string;
  policy_id: string | null;
  policy_number: string | null;
}

interface LeadRow {
  id: string;
  lead_id: string | null;
  stage: string;
  interests: string[];
  contact_id: string;
  contact_first: string;
  contact_last: string;
  contact_phone: string;
  plan_name: string | null;
}

interface EmployeeRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  designation: string | null;
  department: string | null;
  email: string | null;
  avatar_url: string | null;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) { }

  async search(
    tenantId: string,
    userId: string,
    role: string,
    q: string,
    type: SearchType = 'all',
    limit = 10,
  ) {
    if (!q || q.trim().length < 1) {
      return { data: { contacts: [], policies: [], claims: [], leads: [], employees: [], operations: [] } };
    }
    const safeLimit = (limit && !isNaN(limit) && limit > 0) ? Math.min(limit, 50) : 10;
    const term = q.trim();

    const run = async <T>(fn: () => Promise<T[]>): Promise<T[]> => {
      try {
        return await fn();
      } catch (err) {
        console.error('SEARCH RUN ERROR:', err);
        return [];
      }
    };

    const [contacts, policies, claims, leads, employees, operations] = await Promise.all([
      type === 'all' || type === 'contacts'
        ? run(() => this.searchContacts(tenantId, userId, role, term, safeLimit))
        : Promise.resolve([]),
      type === 'all' || type === 'policies'
        ? run(() => this.searchPolicies(tenantId, userId, role, term, safeLimit))
        : Promise.resolve([]),
      type === 'all' || type === 'claims'
        ? run(() => this.searchClaims(tenantId, userId, role, term, safeLimit))
        : Promise.resolve([]),
      type === 'all' || type === 'leads'
        ? run(() => this.searchLeads(tenantId, userId, role, term, safeLimit))
        : Promise.resolve([]),
      type === 'all' || type === 'employees'
        ? run(() => this.searchEmployees(tenantId, term, safeLimit))
        : Promise.resolve([]),
      type === 'all' || type === 'operations'
        ? run(() => this.searchOperations(tenantId, term, safeLimit))
        : Promise.resolve([]),
    ]);

    return {
      data: {
        contacts: contacts.map(this.mapContact),
        policies: policies.map(this.mapPolicy),
        claims: claims.map(this.mapClaim),
        leads: leads.map(this.mapLead),
        employees: employees.map(this.mapEmployee),
        operations: operations.map(this.mapOperation),
      },
    };
  }

  async suggestions(tenantId: string, q: string, limit = 5) {
    if (!q || q.trim().length < 1) return { data: [] };
    const safeLimit = (limit && !isNaN(limit) && limit > 0) ? Math.min(limit, 10) : 5;

    const term = q.trim();
    const rows = await this.prisma.contact.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
        relatedTo: { none: {} },
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term } },
          { alternatePhone: { contains: term } },
          { email: { contains: term, mode: 'insensitive' } },
          { aadhaarNumber: { contains: term } },
        ],
      },
      take: safeLimit,
      select: { id: true, firstName: true, lastName: true, phone: true },
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        label: `${row.firstName} ${row.lastName}`.trim(),
        sub: row.phone,
        entity: 'contact',
      })),
    };
  }

  private searchContacts(
    tenantId: string, userId: string, role: string, term: string, limit: number,
  ): Promise<ContactRow[]> {
    const isOwner = role === UserRole.OWNER || role === UserRole.SUPERADMIN || (role as string) === 'ADMIN';
    const tokens = term.split(/\s+/).filter(Boolean);

    const OR: any[] = [
      { contactId: { contains: term, mode: 'insensitive' } },
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term } },
      { alternatePhone: { contains: term } },
      { email: { contains: term, mode: 'insensitive' } },
      { panNumber: { contains: term, mode: 'insensitive' } },
      { aadhaarNumber: { contains: term } },
      { notes: { contains: term, mode: 'insensitive' } },
    ];

    if (tokens.length >= 2) {
      OR.push({
        AND: tokens.map(tok => ({
          OR: [
            { firstName: { contains: tok, mode: 'insensitive' } },
            { lastName: { contains: tok, mode: 'insensitive' } },
          ],
        })),
      });
    }

    const where: any = {
      tenantId,
      deletedAt: null,
      OR,
    };

    if (!isOwner && userId) {
      where.AND = [
        {
          OR: [
            { assignedEmployeeId: userId },
            { policies: { some: { assignedEmployeeId: userId } } },
            { productInterests: { some: { assignedEmployeeId: userId } } },
            { claims: { some: { assignedEmployeeId: userId } } },
          ],
        },
      ];
    }

    return this.prisma.contact.findMany({
      where,
      take: limit,
      select: {
        id: true,
        contactId: true,
        firstName: true,
        lastName: true,
        phone: true,
        alternatePhone: true,
        email: true,
        aadhaarNumber: true,
        panNumber: true,
        avatarUrl: true,
      },
    }).then((rows) => rows.map((row) => ({
      id: row.id,
      contact_id: (row as any).contactId ?? null,
      first_name: row.firstName,
      last_name: row.lastName,
      phone: row.phone,
      alternate_phone: row.alternatePhone,
      email: row.email,
      aadhaar_number: row.aadhaarNumber,
      pan_number: row.panNumber,
      avatar_url: row.avatarUrl,
    })));
  }

  private searchPolicies(
    tenantId: string, userId: string, role: string, term: string, limit: number,
  ): Promise<PolicyRow[]> {
    const isOwner = role === UserRole.OWNER || role === UserRole.SUPERADMIN || (role as string) === 'ADMIN';
    const tokens = term.split(/\s+/).filter(Boolean);

    const OR: any[] = [
      { policyNumber: { contains: term, mode: 'insensitive' } },
      { agentCode: { contains: term, mode: 'insensitive' } },
      { notes: { contains: term, mode: 'insensitive' } },
      { plan: { is: { name: { contains: term, mode: 'insensitive' } } } },
      { plan: { is: { company: { is: { name: { contains: term, mode: 'insensitive' } } } } } },
      { contact: { is: { firstName: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { lastName: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { phone: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { alternatePhone: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { email: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { aadhaarNumber: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { panNumber: { contains: term, mode: 'insensitive' } } } },
      { members: { some: { name: { contains: term, mode: 'insensitive' } } } },
    ];

    if (tokens.length >= 2) {
      OR.push({
        contact: {
          is: {
            AND: tokens.map(tok => ({
              OR: [
                { firstName: { contains: tok, mode: 'insensitive' } },
                { lastName: { contains: tok, mode: 'insensitive' } },
              ],
            })),
          },
        },
      });
    }

    return this.prisma.policy.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(isOwner ? {} : { assignedEmployeeId: userId }),
        OR,
      },
      take: limit,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        plan: { select: { name: true, company: { select: { name: true } } } },
      },
    }).then((rows) => rows.map((row) => ({
      id: row.id,
      policy_number: row.policyNumber,
      status: row.status,
      contact_id: row.contact?.id,
      contact_first: row.contact?.firstName,
      contact_last: row.contact?.lastName,
      contact_phone: row.contact?.phone,
      plan_name: row.plan?.name ?? null,
      company_name: row.plan?.company?.name ?? null,
    })));
  }

  private searchClaims(
    tenantId: string, userId: string, role: string, term: string, limit: number,
  ): Promise<ClaimRow[]> {
    const isOwner = role === UserRole.OWNER || role === UserRole.SUPERADMIN || (role as string) === 'ADMIN';
    const tokens = term.split(/\s+/).filter(Boolean);

    const OR: any[] = [
      { claimNumber: { contains: term, mode: 'insensitive' } },
      { claimType: { contains: term, mode: 'insensitive' } },
      { notes: { contains: term, mode: 'insensitive' } },
      { rejectionReason: { contains: term, mode: 'insensitive' } },
      { policy: { is: { policyNumber: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { firstName: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { lastName: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { phone: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { alternatePhone: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { email: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { aadhaarNumber: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { panNumber: { contains: term, mode: 'insensitive' } } } },
    ];

    if (tokens.length >= 2) {
      OR.push({
        contact: {
          is: {
            AND: tokens.map(tok => ({
              OR: [
                { firstName: { contains: tok, mode: 'insensitive' } },
                { lastName: { contains: tok, mode: 'insensitive' } },
              ],
            })),
          },
        },
      });
    }

    return this.prisma.claim.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(isOwner ? {} : { assignedEmployeeId: userId }),
        OR,
      },
      take: limit,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        policy: { select: { id: true, policyNumber: true } },
      },
    }).then((rows) => rows.map((row) => ({
      id: row.id,
      claim_number: row.claimNumber,
      status: row.status,
      claim_type: row.claimType,
      contact_id: row.contact?.id,
      contact_first: row.contact?.firstName,
      contact_last: row.contact?.lastName,
      contact_phone: row.contact?.phone,
      policy_id: row.policy?.id ?? null,
      policy_number: row.policy?.policyNumber ?? null,
    })));
  }

  private searchLeads(
    tenantId: string, userId: string, role: string, term: string, limit: number,
  ): Promise<LeadRow[]> {
    const isOwner = role === UserRole.OWNER || role === UserRole.SUPERADMIN || (role as string) === 'ADMIN';
    const tokens = term.split(/\s+/).filter(Boolean);

    const OR: any[] = [
      { leadId: { contains: term, mode: 'insensitive' } },
      { notes: { contains: term, mode: 'insensitive' } },
      { source: { contains: term, mode: 'insensitive' } },
      { interests: { hasSome: [term] } },
      { plan: { is: { name: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { firstName: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { lastName: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { phone: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { alternatePhone: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { email: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { aadhaarNumber: { contains: term, mode: 'insensitive' } } } },
      { contact: { is: { panNumber: { contains: term, mode: 'insensitive' } } } },
    ];

    if (tokens.length >= 2) {
      OR.push({
        contact: {
          is: {
            AND: tokens.map(tok => ({
              OR: [
                { firstName: { contains: tok, mode: 'insensitive' } },
                { lastName: { contains: tok, mode: 'insensitive' } },
              ],
            })),
          },
        },
      });
    }

    return this.prisma.productInterest.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(isOwner ? {} : { assignedEmployeeId: userId }),
        OR,
      },
      take: limit,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        plan: { select: { name: true } },
      },
    }).then((rows) => rows.map((row) => ({
      id: row.id,
      lead_id: row.leadId ?? null,
      stage: row.stage,
      interests: row.interests || [],
      contact_id: row.contact?.id,
      contact_first: row.contact?.firstName,
      contact_last: row.contact?.lastName,
      contact_phone: row.contact?.phone,
      plan_name: row.plan?.name ?? (row.interests?.length ? row.interests.join(', ') : null),
    })));
  }

  private searchEmployees(
    tenantId: string, term: string, limit: number,
  ): Promise<EmployeeRow[]> {
    const tokens = term.split(/\s+/).filter(Boolean);
    const OR: any[] = [
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term } },
      { designation: { contains: term, mode: 'insensitive' } },
      { department: { contains: term, mode: 'insensitive' } },
      { user: { is: { email: { contains: term, mode: 'insensitive' } } } },
    ];

    if (tokens.length >= 2) {
      OR.push({
        AND: tokens.map(tok => ({
          OR: [
            { firstName: { contains: tok, mode: 'insensitive' } },
            { lastName: { contains: tok, mode: 'insensitive' } },
          ],
        })),
      });
    }

    return this.prisma.employeeProfile.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR,
      },
      take: limit,
      include: {
        user: { select: { email: true } },
      },
    }).then(rows => rows.map(r => ({
      id: r.id,
      first_name: r.firstName,
      last_name: r.lastName,
      phone: r.phone,
      designation: r.designation,
      department: r.department,
      email: r.user?.email ?? null,
      avatar_url: r.avatarUrl ?? null,
    })));
  }

  private async searchOperations(
    tenantId: string, term: string, limit: number,
  ) {
    const [companies, plans] = await Promise.all([
      this.prisma.insuranceCompany.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { shortCode: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: limit,
      }),
      this.prisma.insurancePlan.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { planCode: { contains: term, mode: 'insensitive' } },
            { category: { contains: term, mode: 'insensitive' } },
          ],
        },
        include: { company: { select: { name: true } } },
        take: limit,
      }),
    ]);

    const result = [
      ...companies.map(c => ({
        id: c.id,
        name: c.name,
        type: 'Insurance Company',
        sub: c.shortCode || 'Company',
      })),
      ...plans.map(p => ({
        id: p.id,
        name: p.name,
        type: 'Plan',
        sub: `${p.company?.name || ''} · ${p.category || ''}`,
      })),
    ];
    return result.slice(0, limit);
  }

  private mapContact(r: ContactRow) {
    const contactName = `${r.first_name || ''} ${r.last_name || ''}`.trim();
    return {
      id: r.id,
      entityType: 'contact' as const,
      firstName: r.first_name,
      lastName: r.last_name,
      contactName,
      phone: r.phone,
      alternatePhone: r.alternate_phone,
      email: r.email,
      aadhaarNumber: r.aadhaar_number,
      panNumber: r.pan_number,
      avatarUrl: r.avatar_url,
      contact: {
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        phone: r.phone,
        email: r.email,
      },
    };
  }

  private mapPolicy(r: PolicyRow) {
    const contactName = `${r.contact_first || ''} ${r.contact_last || ''}`.trim();
    return {
      id: r.id,
      entityType: 'policy' as const,
      policyNumber: r.policy_number,
      status: r.status,
      contactName,
      phone: r.contact_phone,
      planName: r.plan_name,
      companyName: r.company_name,
      contact: {
        id: r.contact_id,
        firstName: r.contact_first,
        lastName: r.contact_last,
        phone: r.contact_phone,
      },
      plan: {
        name: r.plan_name,
        company: r.company_name ? { name: r.company_name } : null,
      },
    };
  }

  private mapClaim(r: ClaimRow) {
    const contactName = `${r.contact_first || ''} ${r.contact_last || ''}`.trim();
    return {
      id: r.id,
      entityType: 'claim' as const,
      claimNumber: r.claim_number,
      status: r.status,
      claimType: r.claim_type,
      contactName,
      phone: r.contact_phone,
      policyNumber: r.policy_number,
      contact: {
        id: r.contact_id,
        firstName: r.contact_first,
        lastName: r.contact_last,
        phone: r.contact_phone,
      },
      policy: {
        id: r.policy_id,
        policyNumber: r.policy_number,
      },
    };
  }

  private mapLead(r: LeadRow) {
    const contactName = `${r.contact_first || ''} ${r.contact_last || ''}`.trim();
    return {
      id: r.id,
      entityType: 'lead' as const,
      stage: r.stage,
      firstName: r.contact_first,
      lastName: r.contact_last,
      contactName,
      phone: r.contact_phone,
      planName: r.plan_name,
      interests: r.interests,
      contact: {
        id: r.contact_id,
        firstName: r.contact_first,
        lastName: r.contact_last,
        phone: r.contact_phone,
      },
      plan: {
        name: r.plan_name,
      },
    };
  }

  private mapEmployee(r: EmployeeRow) {
    const contactName = `${r.first_name || ''} ${r.last_name || ''}`.trim();
    return {
      id: r.id,
      entityType: 'employee' as const,
      firstName: r.first_name,
      lastName: r.last_name,
      contactName,
      phone: r.phone,
      designation: r.designation,
      department: r.department,
      email: r.email,
      avatarUrl: r.avatar_url,
    };
  }

  private mapOperation(r: any) {
    return {
      id: r.id,
      entityType: 'operation' as const,
      name: r.name,
      type: r.type,
      sub: r.sub,
    };
  }
}
