import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';

export type SearchType = 'contacts' | 'policies' | 'claims' | 'leads' | 'all';

interface ContactRow {
  id: string;
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
  stage: string;
  interests: string[];
  contact_id: string;
  contact_first: string;
  contact_last: string;
  contact_phone: string;
  plan_name: string | null;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  private isOwnerRole(role: string): boolean {
    return role === UserRole.OWNER || role === UserRole.SUPERADMIN || (role as string) === 'ADMIN';
  }

  /** Match contacts list access — employees see assigned + linked records. */
  private employeeContactScope(userId: string) {
    return {
      OR: [
        { assignedEmployeeId: userId },
        { policies: { some: { assignedEmployeeId: userId } } },
        { productInterests: { some: { assignedEmployeeId: userId } } },
        { claims: { some: { assignedEmployeeId: userId } } },
      ],
    };
  }

  private contactNameOr(term: string, tokens: string[]): any[] {
    const OR: any[] = [
      { contact: { firstName: { contains: term, mode: 'insensitive' } } },
      { contact: { lastName: { contains: term, mode: 'insensitive' } } },
      { contact: { phone: { contains: term } } },
      { contact: { alternatePhone: { contains: term } } },
      { contact: { email: { contains: term, mode: 'insensitive' } } },
      { contact: { aadhaarNumber: { contains: term } } },
      { contact: { panNumber: { contains: term, mode: 'insensitive' } } },
    ];

    if (tokens.length >= 2) {
      const first = tokens[0];
      const last = tokens.slice(1).join(' ');
      OR.push({
        contact: {
          AND: [
            { firstName: { contains: first, mode: 'insensitive' } },
            { lastName: { contains: last, mode: 'insensitive' } },
          ],
        },
      });
    }

    return OR;
  }

  async search(
    tenantId: string,
    userId: string,
    role: string,
    q: string,
    type: SearchType = 'all',
    limit?: number,
  ) {
    if (!q || q.trim().length < 1) {
      return { data: { contacts: [], policies: [], claims: [], leads: [] } };
    }

    const term = q.trim();
    const normalizedLimit: number = typeof limit === 'number' && Number.isInteger(limit) && limit > 0 ? limit : 10;
    const take = Math.min(normalizedLimit, 50);
    this.logger.log(`Global search start | term="${term}" tenantId=${tenantId} userId=${userId} role=${role} type=${type} limit=${take}`);

    const run = async <T>(fn: () => Promise<T[]>, entity: string): Promise<T[]> => {
      try {
        const rows = await fn();
        this.logger.log(`Global search result | entity=${entity} term="${term}" count=${rows.length}`);
        return rows;
      } catch (err) {
        this.logger.error(`Global search error | entity=${entity} term="${term}" tenantId=${tenantId} userId=${userId} role=${role}`, err as any);
        return [];
      }
    };

    const [contacts, policies, claims, leads] = await Promise.all([
      type === 'all' || type === 'contacts'
        ? run(() => this.searchContacts(tenantId, userId, role, term, take), 'contacts')
        : Promise.resolve([]),
      type === 'all' || type === 'policies'
        ? run(() => this.searchPolicies(tenantId, userId, role, term, take), 'policies')
        : Promise.resolve([]),
      type === 'all' || type === 'claims'
        ? run(() => this.searchClaims(tenantId, userId, role, term, take), 'claims')
        : Promise.resolve([]),
      type === 'all' || type === 'leads'
        ? run(() => this.searchLeads(tenantId, userId, role, term, take), 'leads')
        : Promise.resolve([]),
    ]);

    return {
      data: {
        contacts: contacts.map(c => this.mapContact(c)),
        policies: policies.map(p => this.mapPolicy(p)),
        claims: claims.map(c => this.mapClaim(c)),
        leads: leads.map(l => this.mapLead(l)),
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
        AND: [
          {
            OR: [
              { deletedAt: null },
              { deletedAt: { isSet: false } },
            ],
          },
          {
            OR: [
              { firstName: { contains: term, mode: 'insensitive' } },
              { lastName: { contains: term, mode: 'insensitive' } },
              { phone: { contains: term } },
              { alternatePhone: { contains: term } },
              { email: { contains: term, mode: 'insensitive' } },
              { aadhaarNumber: { contains: term } },
            ],
          },
        ],
      },
      take: limit,
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
    const tokens = term.split(/\s+/).filter(Boolean);

    const searchOR: any[] = [
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term, mode: 'insensitive' } },
      { alternatePhone: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { panNumber: { contains: term, mode: 'insensitive' } },
      { aadhaarNumber: { contains: term, mode: 'insensitive' } },
      { notes: { contains: term, mode: 'insensitive' } },
      { tags: { has: term } },
      { source: { contains: term, mode: 'insensitive' } },
      { leadStage: { contains: term, mode: 'insensitive' } },
      { leadStatus: { contains: term, mode: 'insensitive' } },
      { leadType: { contains: term, mode: 'insensitive' } },
      { addresses: { some: { OR: [
        { line1: { contains: term, mode: 'insensitive' } },
        { line2: { contains: term, mode: 'insensitive' } },
        { city: { contains: term, mode: 'insensitive' } },
        { state: { contains: term, mode: 'insensitive' } },
        { pincode: { contains: term, mode: 'insensitive' } },
        { country: { contains: term, mode: 'insensitive' } }
      ] } } },
      { occupations: { some: { OR: [
        { companyName: { contains: term, mode: 'insensitive' } },
        { designation: { contains: term, mode: 'insensitive' } },
        { industry: { contains: term, mode: 'insensitive' } },
        { type: { contains: term, mode: 'insensitive' } }
      ] } } }
    ];

    if (tokens.length >= 2) {
      searchOR.push(
        {
          AND: [
            { firstName: { contains: tokens[0], mode: 'insensitive' } },
            { lastName: { contains: tokens.slice(1).join(' '), mode: 'insensitive' } },
          ],
        },
        {
          AND: [
            { firstName: { contains: tokens.slice(1).join(' '), mode: 'insensitive' } },
            { lastName: { contains: tokens[0], mode: 'insensitive' } },
          ],
        }
      );
    }

    return this.prisma.contact.findMany({
      where: {
        tenantId,
        isActive: true,
        AND: [
          {
            OR: [
              { deletedAt: null },
              { deletedAt: { isSet: false } },
            ],
          },
          { OR: searchOR },
        ],
      },
      take: limit,
      select: {
        id: true,
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
    const tokens = term.split(/\s+/).filter(Boolean);

    const upperTerm = term.toUpperCase().replace(/\s+/g, '_');
    const statusMatch = ['ACTIVE', 'LAPSED', 'EXPIRED', 'CANCELLED', 'SURRENDERED'].includes(upperTerm)
      ? { status: upperTerm }
      : null;

    const searchOR: any[] = [
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
      const first = tokens[0];
      const last = tokens.slice(1).join(' ');
      searchOR.push(
        {
          contact: {
            is: {
              AND: [
                { firstName: { contains: first, mode: 'insensitive' } },
                { lastName: { contains: last, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          contact: {
            is: {
              AND: [
                { firstName: { contains: last, mode: 'insensitive' } },
                { lastName: { contains: first, mode: 'insensitive' } },
              ],
            },
          },
        }
      );
    }
    if (statusMatch) searchOR.push(statusMatch);

    return this.prisma.policy.findMany({
      where: {
        tenantId,
        AND: [
          {
            OR: [
              { deletedAt: null },
              { deletedAt: { isSet: false } },
            ],
          },
          { OR: searchOR },
        ],
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
      contact_id: row.contact?.id ?? '',
      contact_first: row.contact?.firstName ?? '',
      contact_last: row.contact?.lastName ?? '',
      contact_phone: row.contact?.phone ?? '',
      plan_name: row.plan?.name ?? null,
      company_name: row.plan?.company?.name ?? null,
    })));
  }

  private searchClaims(
    tenantId: string, userId: string, role: string, term: string, limit: number,
  ): Promise<ClaimRow[]> {
    const tokens = term.split(/\s+/).filter(Boolean);

    const upperTerm = term.toUpperCase().replace(/\s+/g, '_');
    const statusMatch = ['INTIMATED', 'DOC_COLLECTION', 'FILED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SETTLED'].includes(upperTerm)
      ? { status: upperTerm }
      : null;

    const searchOR: any[] = [
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
      { expenses: { some: { OR: [
        { description: { contains: term, mode: 'insensitive' } },
        { category: { contains: term, mode: 'insensitive' } }
      ] } } }
    ];

    if (tokens.length >= 2) {
      const first = tokens[0];
      const last = tokens.slice(1).join(' ');
      searchOR.push(
        {
          contact: {
            is: {
              AND: [
                { firstName: { contains: first, mode: 'insensitive' } },
                { lastName: { contains: last, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          contact: {
            is: {
              AND: [
                { firstName: { contains: last, mode: 'insensitive' } },
                { lastName: { contains: first, mode: 'insensitive' } },
              ],
            },
          },
        }
      );
    }
    if (statusMatch) searchOR.push(statusMatch);

    return this.prisma.claim.findMany({
      where: {
        tenantId,
        AND: [
          {
            OR: [
              { deletedAt: null },
              { deletedAt: { isSet: false } },
            ],
          },
          { OR: searchOR },
        ],
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
      contact_id: row.contact?.id ?? '',
      contact_first: row.contact?.firstName ?? '',
      contact_last: row.contact?.lastName ?? '',
      contact_phone: row.contact?.phone ?? '',
      policy_id: row.policy?.id ?? null,
      policy_number: row.policy?.policyNumber ?? null,
    })));
  }

  private searchLeads(
    tenantId: string, userId: string, role: string, term: string, limit: number,
  ): Promise<LeadRow[]> {
    const tokens = term.split(/\s+/).filter(Boolean);

    const upperTerm = term.toUpperCase().replace(/\s+/g, '_');
    const statusMatch = ['OPEN', 'TO_CONTACT', 'CONTACTED', 'PROPOSAL_SENT', 'IN_DISCUSSION', 'LOGIN_PROGRESS', 'PAYMENT_DONE', 'LOST'].includes(upperTerm)
      ? { stage: upperTerm }
      : null;

    const searchOR: any[] = [
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
      { lostReason: { contains: term, mode: 'insensitive' } },
      { consultations: { some: { notes: { contains: term, mode: 'insensitive' } } } }
    ];

    if (tokens.length >= 2) {
      const first = tokens[0];
      const last = tokens.slice(1).join(' ');
      searchOR.push(
        {
          contact: {
            is: {
              AND: [
                { firstName: { contains: first, mode: 'insensitive' } },
                { lastName: { contains: last, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          contact: {
            is: {
              AND: [
                { firstName: { contains: last, mode: 'insensitive' } },
                { lastName: { contains: first, mode: 'insensitive' } },
              ],
            },
          },
        }
      );
    }
    if (statusMatch) searchOR.push(statusMatch);

    return this.prisma.productInterest.findMany({
      where: {
        tenantId,
        AND: [
          {
            OR: [
              { deletedAt: null },
              { deletedAt: { isSet: false } },
            ],
          },
          { OR: searchOR },
        ],
      },
      take: limit,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        plan: { select: { name: true } },
      },
    }).then((rows) => rows.map((row) => ({
      id: row.id,
      stage: row.stage,
      interests: row.interests || [],
      contact_id: row.contact?.id ?? '',
      contact_first: row.contact?.firstName ?? '',
      contact_last: row.contact?.lastName ?? '',
      contact_phone: row.contact?.phone ?? '',
      plan_name: row.plan?.name ?? (row.interests?.length ? row.interests.join(', ') : null),
    })));
  }

  private mapContact(r: ContactRow) {
    const contactName = `${r.first_name || ''} ${r.last_name || ''}`.trim();
    return {
      id:             r.id,
      entityType:     'contact' as const,
      firstName:      r.first_name,
      lastName:       r.last_name,
      first_name:     r.first_name,
      last_name:      r.last_name,
      contactName,
      contact_first:  r.first_name,
      contact_last:   r.last_name,
      phone:          r.phone,
      alternatePhone: r.alternate_phone,
      email:          r.email,
      aadhaarNumber:  r.aadhaar_number,
      aadhaar_number: r.aadhaar_number,
      panNumber:      r.pan_number,
      avatarUrl:      r.avatar_url,
      contact: {
        id:        r.id,
        firstName: r.first_name,
        lastName:  r.last_name,
        phone:     r.phone,
        email:     r.email,
      },
    };
  }

  private mapPolicy(r: PolicyRow) {
    const contactName = `${r.contact_first || ''} ${r.contact_last || ''}`.trim();
    return {
      id:            r.id,
      entityType:    'policy' as const,
      policyNumber:  r.policy_number,
      policy_number: r.policy_number,
      status:        r.status,
      contactName,
      contact_first: r.contact_first,
      contact_last:  r.contact_last,
      phone:         r.contact_phone,
      planName:      r.plan_name,
      plan_name:     r.plan_name,
      companyName:   r.company_name,
      company_name:  r.company_name,
      contact: {
        id:        r.contact_id,
        firstName: r.contact_first,
        lastName:  r.contact_last,
        phone:     r.contact_phone,
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
      id:            r.id,
      entityType:    'claim' as const,
      claimNumber:   r.claim_number,
      claim_number:  r.claim_number,
      status:        r.status,
      claimType:     r.claim_type,
      claim_type:    r.claim_type,
      contactName,
      contact_first: r.contact_first,
      contact_last:  r.contact_last,
      phone:         r.contact_phone,
      policyNumber:  r.policy_number,
      policy_number: r.policy_number,
      contact: {
        id:        r.contact_id,
        firstName: r.contact_first,
        lastName:  r.contact_last,
        phone:     r.contact_phone,
      },
      policy: {
        id:           r.policy_id,
        policyNumber: r.policy_number,
      },
    };
  }

  private mapLead(r: LeadRow) {
    const contactName = `${r.contact_first || ''} ${r.contact_last || ''}`.trim();
    return {
      id:            r.id,
      entityType:    'lead' as const,
      stage:         r.stage,
      firstName:     r.contact_first,
      lastName:      r.contact_last,
      first_name:    r.contact_first,
      last_name:     r.contact_last,
      contactName,
      contact_first: r.contact_first,
      contact_last:  r.contact_last,
      phone:         r.contact_phone,
      planName:      r.plan_name,
      plan_name:     r.plan_name,
      interests:     r.interests,
      contact: {
        id:        r.contact_id,
        firstName: r.contact_first,
        lastName:  r.contact_last,
        phone:     r.contact_phone,
      },
      plan: {
        name: r.plan_name,
      },
    };
  }
}
