import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type SearchType = 'contacts' | 'policies' | 'claims' | 'leads' | 'all';

// MongoDB-safe soft-delete filter:
// Prisma MongoDB { deletedAt: null } only matches documents where the field
// exists AND is explicitly null. Documents where the field is absent/undefined
// are NOT matched. Using OR covers both cases.
const notDeleted = {
  OR: [
    { deletedAt: null },
    { deletedAt: { isSet: false } },
  ],
};

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) { }

  // ─── Main search entry ────────────────────────────────────────────────────
  async search(
    tenantId: string,
    userId: string,
    role: string,
    q: string,
    type: SearchType = 'all',
    limit = 10,
  ) {
    if (!q || q.trim().length < 1) {
      return { success: true, data: { contacts: [], policies: [], claims: [], leads: [] }, message: 'OK' };
    }

    const take = Math.min(50, Math.max(1, isNaN(Number(limit)) ? 10 : Number(limit) || 10));
    const term = q.trim();
    const roleUpper = (role || '').toUpperCase();
    const isOwner = roleUpper === 'OWNER' || roleUpper === 'SUPERADMIN' || roleUpper === 'ADMIN';

    this.logger.log(`SEARCH: term="${term}" tenantId=${tenantId} userId=${userId} role=${role} isOwner=${isOwner}`);

    if (!tenantId) {
      this.logger.error('tenantId is UNDEFINED!');
      return { success: true, data: { contacts: [], policies: [], claims: [], leads: [] }, message: 'OK' };
    }

    const matchingContactIds = await this.getMatchingContactIds(tenantId, userId, isOwner, term, take * 4);
    this.logger.log(`matchingContactIds: ${matchingContactIds.length}`);

    const run = async <T>(label: string, fn: () => Promise<T[]>): Promise<T[]> => {
      try {
        const result = await fn();
        this.logger.log(`[${label}] => ${result.length}`);
        return result;
      } catch (err: any) {
        this.logger.error(`[${label}] ERROR: ${err.message}`);
        return [];
      }
    };

    const [contacts, policies, claims, leads] = await Promise.all([
      type === 'all' || type === 'contacts'
        ? run('contacts', () => this.searchContacts(tenantId, userId, term, take, isOwner))
        : Promise.resolve([]),
      type === 'all' || type === 'policies'
        ? run('policies', () => this.searchPolicies(tenantId, userId, term, take, isOwner, matchingContactIds))
        : Promise.resolve([]),
      type === 'all' || type === 'claims'
        ? run('claims', () => this.searchClaims(tenantId, userId, term, take, isOwner, matchingContactIds))
        : Promise.resolve([]),
      type === 'all' || type === 'leads'
        ? run('leads', () => this.searchLeads(tenantId, userId, term, take, isOwner, matchingContactIds))
        : Promise.resolve([]),
    ]);

    return {
      success: true,
      message: 'OK',
      data: {
        contacts: contacts.map(r => this.mapContact(r)),
        policies: policies.map(r => this.mapPolicy(r)),
        claims: claims.map(r => this.mapClaim(r)),
        leads: leads.map(r => this.mapLead(r)),
      },
    };
  }

  // ─── Autocomplete suggestions ─────────────────────────────────────────────
  async suggestions(tenantId: string, q: string, limit = 5) {
    if (!q || q.trim().length < 1) return { data: [] };
    const rows = await this.prisma.contact.findMany({
      where: { tenantId, ...notDeleted, OR: this.buildContactOR(q.trim()) } as any,
      take: Math.min(10, Math.max(1, limit)),
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    return {
      data: rows.map(r => ({ id: r.id, label: `${r.firstName} ${r.lastName}`.trim(), sub: r.phone, entity: 'contact' })),
    };
  }

  // ─── Pre-fetch contact IDs matching search term ───────────────────────────
  private async getMatchingContactIds(
    tenantId: string, userId: string, isOwner: boolean, term: string, take: number,
  ): Promise<string[]> {
    try {
      const where: any = { tenantId, ...notDeleted, OR: this.buildContactOR(term) };
      if (!isOwner) where.assignedEmployeeId = userId;
      const rows = await this.prisma.contact.findMany({ where, take, select: { id: true } });
      return rows.map(c => c.id);
    } catch (err: any) {
      this.logger.error(`getMatchingContactIds: ${err.message}`);
      return [];
    }
  }

  // ─── Contact OR filter (name / phone / email / PAN / Aadhaar) ─────────────
  private buildContactOR(term: string): any[] {
    const OR: any[] = [
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term } },
      { alternatePhone: { contains: term } },
      { email: { contains: term, mode: 'insensitive' } },
      { panNumber: { contains: term, mode: 'insensitive' } },
      { aadhaarNumber: { contains: term } },
    ];
    const tokens = term.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      const [f, ...r] = tokens;
      const l = r.join(' ');
      OR.push(
        { firstName: { contains: f, mode: 'insensitive' }, lastName: { contains: l, mode: 'insensitive' } },
        { firstName: { contains: l, mode: 'insensitive' }, lastName: { contains: f, mode: 'insensitive' } },
      );
    }
    return OR;
  }

  // ─── Contacts ─────────────────────────────────────────────────────────────
  private async searchContacts(
    tenantId: string, userId: string, term: string, take: number, isOwner: boolean,
  ) {
    const where: any = { tenantId, ...notDeleted, OR: this.buildContactOR(term) };
    if (!isOwner) where.assignedEmployeeId = userId;
    return this.prisma.contact.findMany({
      where,
      take,
      select: {
        id: true, firstName: true, lastName: true,
        phone: true, alternatePhone: true,
        email: true, aadhaarNumber: true, panNumber: true, avatarUrl: true,
      },
    });
  }

  // ─── Policies ─────────────────────────────────────────────────────────────
  private async searchPolicies(
    tenantId: string, userId: string, term: string, take: number, isOwner: boolean, contactIds: string[],
  ) {
    const OR: any[] = [
      { policyNumber: { contains: term, mode: 'insensitive' } },
      { agentCode: { contains: term, mode: 'insensitive' } },
    ];
    if (contactIds.length > 0) OR.push({ contactId: { in: contactIds } });

    const where: any = { tenantId, ...notDeleted, OR };
    if (!isOwner) where.assignedEmployeeId = userId;

    return this.prisma.policy.findMany({
      where,
      take,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        plan: { select: { name: true, company: { select: { name: true } } } },
      },
    });
  }

  // ─── Claims ───────────────────────────────────────────────────────────────
  private async searchClaims(
    tenantId: string, userId: string, term: string, take: number, isOwner: boolean, contactIds: string[],
  ) {
    const OR: any[] = [{ claimNumber: { contains: term, mode: 'insensitive' } }];
    if (contactIds.length > 0) OR.push({ contactId: { in: contactIds } });

    const where: any = { tenantId, ...notDeleted, OR };
    if (!isOwner) where.assignedEmployeeId = userId;

    return this.prisma.claim.findMany({
      where,
      take,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        policy: { select: { id: true, policyNumber: true } },
      },
    });
  }

  // ─── Leads (ProductInterest) ──────────────────────────────────────────────
  private async searchLeads(
    tenantId: string, userId: string, term: string, take: number, isOwner: boolean, contactIds: string[],
  ) {
    const termLower = term.toLowerCase();
    const baseWhere: any = {
      tenantId,
      ...notDeleted,
      ...(isOwner ? {} : { assignedEmployeeId: userId }),
    };

    let rows: any[] = [];
    if (contactIds.length > 0) {
      rows = await this.prisma.productInterest.findMany({
        where: { ...baseWhere, contactId: { in: contactIds } },
        take,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
          plan: { select: { name: true } },
        },
      });
    }

    // In-memory interests[] match
    const allLeads = await this.prisma.productInterest.findMany({
      where: baseWhere, select: { id: true, interests: true },
    });
    const interestMatchIds = new Set(
      allLeads.filter(l => (l.interests || []).some(i => i.toLowerCase().includes(termLower))).map(l => l.id),
    );
    const seenIds = new Set(rows.map((r: any) => r.id));
    const extraIds = [...interestMatchIds].filter(id => !seenIds.has(id));

    let extraRows: any[] = [];
    if (extraIds.length > 0) {
      extraRows = await this.prisma.productInterest.findMany({
        where: { id: { in: extraIds }, tenantId },
        take,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
          plan: { select: { name: true } },
        },
      });
    }
    return [...rows, ...extraRows].slice(0, take);
  }

  // ─── Mappers ──────────────────────────────────────────────────────────────
  private mapContact(r: any) {
    return {
      id: r.id, entityType: 'contact' as const,
      firstName: r.firstName, lastName: r.lastName,
      contactName: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
      phone: r.phone, alternatePhone: r.alternatePhone,
      email: r.email, aadhaarNumber: r.aadhaarNumber, panNumber: r.panNumber, avatarUrl: r.avatarUrl,
      contact: { id: r.id, firstName: r.firstName, lastName: r.lastName, phone: r.phone, email: r.email },
    };
  }

  private mapPolicy(r: any) {
    return {
      id: r.id, entityType: 'policy' as const,
      policyNumber: r.policyNumber, status: r.status,
      contactName: `${r.contact?.firstName || ''} ${r.contact?.lastName || ''}`.trim(),
      phone: r.contact?.phone, planName: r.plan?.name ?? null, companyName: r.plan?.company?.name ?? null,
      contact: r.contact, plan: r.plan,
    };
  }

  private mapClaim(r: any) {
    return {
      id: r.id, entityType: 'claim' as const,
      claimNumber: r.claimNumber, status: r.status, claimType: r.claimType,
      contactName: `${r.contact?.firstName || ''} ${r.contact?.lastName || ''}`.trim(),
      phone: r.contact?.phone, policyNumber: r.policy?.policyNumber ?? null,
      contact: r.contact, policy: r.policy,
    };
  }

  private mapLead(r: any) {
    return {
      id: r.id, entityType: 'lead' as const, stage: r.stage,
      firstName: r.contact?.firstName, lastName: r.contact?.lastName,
      contactName: `${r.contact?.firstName || ''} ${r.contact?.lastName || ''}`.trim(),
      phone: r.contact?.phone, planName: r.plan?.name ?? (r.interests?.length ? r.interests.join(', ') : null),
      interests: r.interests || [], contact: r.contact, plan: r.plan,
    };
  }
}
