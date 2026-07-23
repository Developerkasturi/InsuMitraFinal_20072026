// ─────────────────────────────────────────────────────────────────────────────
// Contacts Repository — all Prisma queries for the Contacts domain.
// Every query is tenant-scoped to enforce data isolation.
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';
import {
  CreateContactDto, UpdateContactDto,
  CreateAddressDto, CreateOccupationDto,
  CreateRelationshipDto, ContactFilterDto,
} from './dto/contact.dto';

@Injectable()
export class ContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── List contacts with search + pagination ─────────────────────────────

  async findAll(tenantId: string, query: ContactFilterDto, userId?: string, role?: UserRole) {
    const {
      page = 1, limit = 20,
      search, sortBy = 'createdAt', sortOrder = 'desc',
      gender, tags, dobFrom, dobTo, isActive = true, occupationType,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId, isActive };

    if (search) {
      where.OR = [
        { firstName:  { contains: search, mode: 'insensitive' } },
        { lastName:   { contains: search, mode: 'insensitive' } },
        { email:      { contains: search, mode: 'insensitive' } },
        { phone:      { contains: search } },
        { panNumber:  { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role === UserRole.EMPLOYEE && userId) {
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

    if (gender) where.gender = gender;
    if (tags && tags.length > 0) where.tags = { hasEvery: tags };
    if (dobFrom || dobTo) {
      where.dateOfBirth = {};
      if (dobFrom) where.dateOfBirth.gte = new Date(dobFrom);
      if (dobTo)   where.dateOfBirth.lte = new Date(dobTo);
    }
    if (occupationType) where.occupations = { some: { type: occupationType } };

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          addresses:   { where: { isPrimary: true }, take: 1 },
          occupations: { where: { isPrimary: true }, take: 1 },
          productInterests: { select: { id: true, stage: true } },
          policies: { select: { id: true, status: true } },
          _count:      { select: { policies: true, documents: true } },
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  // ── Find single contact (with full relations) ───────────────────────────

  async findOne(tenantId: string, id: string) {
    return this.prisma.contact.findFirst({
      where:   { id, tenantId },
      include: {
        addresses:     true,
        occupations:   true,
        relationships: {
          include: {
            relatedContact: {
              select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true },
            },
          },
        },
        relatedTo: {
          include: {
            primaryContact: {
              select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true },
            },
          },
        },
        documents:    { orderBy: { createdAt: 'desc' }, take: 10 },
        activityLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        policies: {
          where:   { status: 'ACTIVE' },
          include: { plan: { include: { company: true } } },
        },
        productInterests: {
          include: {
            consultations: { orderBy: { createdAt: 'desc' } }
          }
        },
        _count: { select: { policies: true, claims: true, documents: true } },
      },
    });
  }
  // ── Lookup by phone (dedup check) ──────────────────────────────

  async findByPhone(tenantId: string, phone: string) {
    return this.prisma.contact.findFirst({
      where:  { tenantId, phone },
      select: { id: true, firstName: true, lastName: true, phone: true, isActive: true },
    });
  }
  // ── Create ──────────────────────────────────────────────────────────────

  async create(tenantId: string, dto: CreateContactDto) {
    const { dateOfBirth, city, followUpDate, ...rest } = dto as any;
    return this.prisma.contact.create({
      data: {
        ...rest,
        tenantId,
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
        ...(followUpDate ? { followUpDate: new Date(followUpDate) } : {}),
      },
    });
  }

  // ── Update ──────────────────────────────────────────────────────────────

  async update(tenantId: string, id: string, dto: UpdateContactDto) {
    const { dateOfBirth, city, followUpDate, ...rest } = dto as any;
    return this.prisma.contact.updateMany({
      where: { id, tenantId },
      data: {
        ...rest,
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
        ...(followUpDate ? { followUpDate: new Date(followUpDate) } : {}),
      } as any,
    });
  }

  // ── Hard delete ─────────────────────────────────────────────────────────

  async remove(tenantId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.contact.findFirstOrThrow({ where: { id, tenantId } });

      // Nullify optional contact FK on nullable models
      await tx.document.updateMany({ where: { contactId: id }, data: { contactId: null } });
      await tx.calendarEvent.updateMany({ where: { contactId: id }, data: { contactId: null } });
      await tx.activityLog.updateMany({ where: { contactId: id }, data: { contactId: null } });

      // Get policy + claim IDs for this contact
      const policies = await tx.policy.findMany({ where: { contactId: id, tenantId }, select: { id: true } });
      const policyIds = policies.map(p => p.id);
      const claims   = await tx.claim.findMany({ where: { contactId: id, tenantId }, select: { id: true } });
      const claimIds = claims.map(c => c.id);

      // Delete claim children, then claims
      if (claimIds.length) {
        await tx.claimExpense.deleteMany({ where: { claimId: { in: claimIds } } });
        await tx.document.updateMany({ where: { claimId: { in: claimIds } }, data: { claimId: null } });
      }
      await tx.claim.deleteMany({ where: { contactId: id, tenantId } });

      // Delete policy children, then policies
      if (policyIds.length) {
        await tx.policyPayment.deleteMany({ where: { policyId: { in: policyIds } } });
        await tx.policyLoan.deleteMany({ where: { policyId: { in: policyIds } } });
        await tx.policyNominee.deleteMany({ where: { policyId: { in: policyIds } } });
        await tx.policyMember.deleteMany({ where: { policyId: { in: policyIds } } });
        await tx.preventiveHealthCheckup.deleteMany({ where: { policyId: { in: policyIds } } });
        await tx.commission.deleteMany({ where: { policyId: { in: policyIds } } });
        await tx.document.updateMany({ where: { policyId: { in: policyIds } }, data: { policyId: null } });
      }
      await tx.policy.deleteMany({ where: { contactId: id, tenantId } });

      // Delete leads (ProductInterestConsultation cascades automatically)
      await tx.productInterest.deleteMany({ where: { contactId: id, tenantId } });

      // Delete linked portal user if any
      const contact = await tx.contact.findUnique({ where: { id }, select: { userId: true } });
      await tx.contact.delete({ where: { id } });
      if (contact?.userId) {
        await tx.user.delete({ where: { id: contact.userId } });
      }
    });
  }

  // ── Addresses ───────────────────────────────────────────────────────────

  async addAddress(contactId: string, tenantId: string, dto: CreateAddressDto) {
    await this.prisma.contact.findFirstOrThrow({ where: { id: contactId, tenantId } });
    if (dto.isPrimary) {
      await this.prisma.address.updateMany({ where: { contactId }, data: { isPrimary: false } });
    }
    return this.prisma.address.create({ data: { ...dto, contactId } });
  }

  async removeAddress(contactId: string, addressId: string, tenantId: string) {
    await this.prisma.contact.findFirstOrThrow({ where: { id: contactId, tenantId } });
    return this.prisma.address.deleteMany({ where: { id: addressId, contactId } });
  }

  // ── Occupations ───────────────────────────────────────────────────────────

  async addOccupation(contactId: string, tenantId: string, dto: CreateOccupationDto) {
    await this.prisma.contact.findFirstOrThrow({ where: { id: contactId, tenantId } });
    return this.prisma.occupation.create({ data: { ...dto, contactId } });
  }

  async removeOccupation(contactId: string, occupationId: string, tenantId: string) {
    await this.prisma.contact.findFirstOrThrow({ where: { id: contactId, tenantId } });
    return this.prisma.occupation.deleteMany({ where: { id: occupationId, contactId } });
  }

  // ── Relationships ──────────────────────────────────────────────────────────

  async addRelationship(primaryContactId: string, tenantId: string, dto: CreateRelationshipDto) {
    await Promise.all([
      this.prisma.contact.findFirstOrThrow({ where: { id: primaryContactId, tenantId } }),
      this.prisma.contact.findFirstOrThrow({ where: { id: dto.relatedContactId, tenantId } }),
    ]);
    return this.prisma.contactRelationship.create({
      data: {
        primaryContactId,
        relatedContactId: dto.relatedContactId,
        relationshipType: dto.relationshipType,
      },
      include: {
        relatedContact: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
  }

  async removeRelationship(primaryContactId: string, relationshipId: string, tenantId: string) {
    await this.prisma.contact.findFirstOrThrow({ where: { id: primaryContactId, tenantId } });
    return this.prisma.contactRelationship.deleteMany({
      where: { id: relationshipId, primaryContactId },
    });
  }

  // ── Bulk operations ────────────────────────────────────────────────────────

  async bulkAddTags(tenantId: string, contactIds: string[], tags: string[]) {
    const contacts = await this.prisma.contact.findMany({
      where:  { id: { in: contactIds }, tenantId },
      select: { id: true, tags: true },
    });
    await Promise.all(
      contacts.map(c =>
        this.prisma.contact.update({
          where: { id: c.id },
          data:  { tags: Array.from(new Set([...c.tags, ...tags])) },
        }),
      ),
    );
    return contacts.length;
  }

  async bulkRemoveTags(tenantId: string, contactIds: string[], tags: string[]) {
    const contacts = await this.prisma.contact.findMany({
      where:  { id: { in: contactIds }, tenantId },
      select: { id: true, tags: true },
    });
    await Promise.all(
      contacts.map(c =>
        this.prisma.contact.update({
          where: { id: c.id },
          data:  { tags: c.tags.filter(t => !tags.includes(t)) },
        }),
      ),
    );
    return contacts.length;
  }

  async bulkDelete(tenantId: string, contactIds: string[]) {
    const result = await this.prisma.contact.updateMany({
      where: { id: { in: contactIds }, tenantId },
      data:  { isActive: false },
    });
    return result.count;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  async countByTenant(tenantId: string) {
    return this.prisma.contact.count({ where: { tenantId, isActive: true } });
  }

  async getStats(tenantId: string) {
    const today        = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [total, addedThisMonth, byGender] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId, isActive: true } }),
      this.prisma.contact.count({
        where: { tenantId, isActive: true, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.contact.groupBy({
        by:     ['gender'],
        where:  { tenantId, isActive: true },
        _count: true,
      }),
    ]);

    return { total, addedThisMonth, byGender };
  }

  async upcomingBirthdays(tenantId: string, days = 30) {
    const today    = new Date();
    const contacts = await this.prisma.contact.findMany({
      where:  { tenantId, isActive: true, dateOfBirth: { not: null } },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, dateOfBirth: true },
    });

    return contacts.filter(c => {
      if (!c.dateOfBirth) return false;
      const dob  = new Date(c.dateOfBirth);
      const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      const diff = (next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= days;
    });
  }

  async recentContacts(tenantId: string, limit = 5) {
    return this.prisma.contact.findMany({
      where:   { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      select:  { id: true, firstName: true, lastName: true, phone: true, createdAt: true },
    });
  }

  // ── CSV export (all active contacts, flat) ─────────────────────────────────

  async findAllForExport(tenantId: string) {
    return this.prisma.contact.findMany({
      where:   { tenantId, isActive: true },
      orderBy: { firstName: 'asc' },
      include: {
        addresses:   { where: { isPrimary: true }, take: 1 },
        occupations: { where: { isPrimary: true }, take: 1 },
      },
    });
  }
}
