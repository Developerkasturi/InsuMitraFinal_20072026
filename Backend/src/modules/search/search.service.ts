import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type SearchType = 'contacts' | 'policies' | 'claims' | 'leads' | 'all';

interface ContactRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
}

interface PolicyRow {
  id: string;
  policy_number: string;
  status: string;
  contact_first: string;
  contact_last: string;
  plan_name: string | null;
}

interface ClaimRow {
  id: string;
  claim_number: string;
  status: string;
  claim_type: string;
  contact_first: string;
  contact_last: string;
}

interface LeadRow {
  id: string;
  stage: string;
  contact_first: string;
  contact_last: string;
  contact_phone: string;
  plan_name: string | null;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    tenantId: string,
    userId: string,
    role: string,
    q: string,
    type: SearchType = 'all',
    limit = 10,
  ) {
    if (!q || q.trim().length < 1) {
      return { data: { contacts: [], policies: [], claims: [], leads: [] } };
    }
    if (limit > 50) limit = 50;

    const term = q.trim();

    const run = async <T>(fn: () => Promise<T[]>): Promise<T[]> => {
      try { return await fn(); } catch { return []; }
    };

    const [contacts, policies, claims, leads] = await Promise.all([
      type === 'all' || type === 'contacts'
        ? run(() => this.searchContacts(tenantId, userId, role, term, limit))
        : Promise.resolve([]),
      type === 'all' || type === 'policies'
        ? run(() => this.searchPolicies(tenantId, userId, role, term, limit))
        : Promise.resolve([]),
      type === 'all' || type === 'claims'
        ? run(() => this.searchClaims(tenantId, userId, role, term, limit))
        : Promise.resolve([]),
      type === 'all' || type === 'leads'
        ? run(() => this.searchLeads(tenantId, userId, role, term, limit))
        : Promise.resolve([]),
    ]);

    return {
      data: {
        contacts: contacts.map(this.mapContact),
        policies: policies.map(this.mapPolicy),
        claims:   claims.map(this.mapClaim),
        leads:    leads.map(this.mapLead),
      },
    };
  }

  async suggestions(tenantId: string, q: string, limit = 5) {
    if (!q || q.trim().length < 1) return { data: [] };
    if (limit > 10) limit = 10;

    const term = q.trim();
    const rows = await this.prisma.contact.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
        OR: [
          { firstName: { contains: term } },
          { lastName: { contains: term } },
          { phone: { contains: term } },
          { email: { contains: term } },
        ],
      },
      take: limit,
      select: { id: true, firstName: true, lastName: true, phone: true },
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        label: `${row.firstName} ${row.lastName}`,
        sub: row.phone,
        entity: 'contact',
      })),
    };
  }

  private searchContacts(
    tenantId: string, userId: string, role: string, term: string, limit: number,
  ): Promise<ContactRow[]> {
    const isOwner = role === 'OWNER' || role === 'SUPERADMIN';
    return this.prisma.contact.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
        ...(isOwner ? {} : { assignedEmployeeId: userId }),
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { panNumber: { contains: term, mode: 'insensitive' } },
          { aadhaarNumber: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        avatarUrl: true,
      },
    }).then((rows) => rows.map((row) => ({
      id: row.id,
      first_name: row.firstName,
      last_name: row.lastName,
      phone: row.phone,
      email: row.email,
      avatar_url: row.avatarUrl,
    })));
  }

  private searchPolicies(
    tenantId: string, userId: string, role: string, term: string, limit: number,
  ): Promise<PolicyRow[]> {
    const isOwner = role === 'OWNER' || role === 'SUPERADMIN';
    return this.prisma.policy.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(isOwner ? {} : { assignedEmployeeId: userId }),
        OR: [
          { policyNumber: { contains: term, mode: 'insensitive' } },
          { contact: { is: { firstName: { contains: term, mode: 'insensitive' } } } },
          { contact: { is: { lastName: { contains: term, mode: 'insensitive' } } } },
          { contact: { is: { phone: { contains: term, mode: 'insensitive' } } } },
        ],
      },
      take: limit,
      include: {
        contact: { select: { firstName: true, lastName: true } },
        plan: { select: { name: true } },
      },
    }).then((rows) => rows.map((row) => ({
      id: row.id,
      policy_number: row.policyNumber,
      status: row.status,
      contact_first: row.contact.firstName,
      contact_last: row.contact.lastName,
      plan_name: row.plan?.name ?? null,
    })));
  }

  private searchClaims(
    tenantId: string, userId: string, role: string, term: string, limit: number,
  ): Promise<ClaimRow[]> {
    const isOwner = role === 'OWNER' || role === 'SUPERADMIN';
    return this.prisma.claim.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(isOwner ? {} : { assignedEmployeeId: userId }),
        OR: [
          { claimNumber: { contains: term, mode: 'insensitive' } },
          { contact: { is: { firstName: { contains: term, mode: 'insensitive' } } } },
          { contact: { is: { lastName: { contains: term, mode: 'insensitive' } } } },
          { contact: { is: { phone: { contains: term, mode: 'insensitive' } } } },
        ],
      },
      take: limit,
      include: {
        contact: { select: { firstName: true, lastName: true } },
      },
    }).then((rows) => rows.map((row) => ({
      id: row.id,
      claim_number: row.claimNumber,
      status: row.status,
      claim_type: row.claimType,
      contact_first: row.contact.firstName,
      contact_last: row.contact.lastName,
    })));
  }

  private searchLeads(
    tenantId: string, userId: string, role: string, term: string, limit: number,
  ): Promise<LeadRow[]> {
    const isOwner = role === 'OWNER' || role === 'SUPERADMIN';
    return this.prisma.productInterest.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(isOwner ? {} : { assignedEmployeeId: userId }),
        OR: [
          { contact: { is: { firstName: { contains: term, mode: 'insensitive' } } } },
          { contact: { is: { lastName: { contains: term, mode: 'insensitive' } } } },
          { contact: { is: { phone: { contains: term, mode: 'insensitive' } } } },
          { plan: { is: { name: { contains: term, mode: 'insensitive' } } } },
        ],
      },
      take: limit,
      include: {
        contact: { select: { firstName: true, lastName: true, phone: true } },
        plan: { select: { name: true } },
      },
    }).then((rows) => rows.map((row) => ({
      id: row.id,
      stage: row.stage,
      contact_first: row.contact.firstName,
      contact_last: row.contact.lastName,
      contact_phone: row.contact.phone,
      plan_name: row.plan?.name ?? null,
    })));
  }

  private mapContact(r: ContactRow) {
    return {
      id:        r.id,
      entityType: 'contact' as const,
      firstName: r.first_name,
      lastName:  r.last_name,
      phone:     r.phone,
      email:     r.email,
      avatarUrl: r.avatar_url,
    };
  }

  private mapPolicy(r: PolicyRow) {
    return {
      id:           r.id,
      entityType:   'policy' as const,
      policyNumber: r.policy_number,
      status:       r.status,
      contactName:  `${r.contact_first} ${r.contact_last}`,
      planName:     r.plan_name,
    };
  }

  private mapClaim(r: ClaimRow) {
    return {
      id:          r.id,
      entityType:  'claim' as const,
      claimNumber: r.claim_number,
      status:      r.status,
      claimType:   r.claim_type,
      contactName: `${r.contact_first} ${r.contact_last}`,
    };
  }

  private mapLead(r: LeadRow) {
    return {
      id:          r.id,
      entityType:  'lead' as const,
      stage:       r.stage,
      contactName: `${r.contact_first} ${r.contact_last}`,
      phone:       r.contact_phone,
      planName:    r.plan_name,
    };
  }
}
