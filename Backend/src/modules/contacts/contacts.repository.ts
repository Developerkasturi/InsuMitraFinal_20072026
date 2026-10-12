// ─────────────────────────────────────────────────────────────────────────────
// Contacts Repository — all Prisma queries for the Contacts domain.
// Every query is tenant-scoped to enforce data isolation.
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole, RelationshipType } from '@prisma/client';
import {
  CreateContactDto, UpdateContactDto,
  CreateAddressDto, CreateOccupationDto,
  CreateRelationshipDto, ContactFilterDto,
} from './dto/contact.dto';

export function parseSafeDate(val: any): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? undefined : val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return undefined;

    let d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;

    const MONTH_MAP: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const parts = trimmed.split(/[\/\-\.\s]+/);
    if (parts.length === 3) {
      let day: number, mon: number, year: number;
      if (/^\d{4}$/.test(parts[0])) {
        year = parseInt(parts[0], 10);
        mon = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        const mStr = parts[1].toLowerCase();
        if (/^\d+$/.test(mStr)) {
          mon = parseInt(mStr, 10) - 1;
        } else if (MONTH_MAP[mStr.slice(0, 3)] !== undefined) {
          mon = MONTH_MAP[mStr.slice(0, 3)];
        } else {
          return undefined;
        }
        year = parseInt(parts[2], 10);
      }
      d = new Date(year, mon, day);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return undefined;
}

@Injectable()
export class ContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── List contacts with search + pagination ─────────────────────────────

  async findAll(tenantId: string, query: ContactFilterDto, userId?: string, role?: UserRole) {
    const {
      page = 1, limit = 20,
      search, sortBy = 'createdAt', sortOrder = 'desc',
      gender, tags, dobFrom, dobTo, isActive, occupationType,
    } = query;

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: any = { tenantId };
    if (isActive === false || (isActive as any) === 'false') {
      where.isActive = false;
    } else if (isActive === true || (isActive as any) === 'true') {
      where.isActive = true;
    }

    if (search) {
      const cleanSearch = search.trim();
      const tokens = cleanSearch.split(/\s+/).filter(Boolean);
      where.OR = [
        { contactId:      { contains: cleanSearch, mode: 'insensitive' } },
        { firstName:      { contains: cleanSearch, mode: 'insensitive' } },
        { lastName:       { contains: cleanSearch, mode: 'insensitive' } },
        { email:          { contains: cleanSearch, mode: 'insensitive' } },
        { phone:          { contains: cleanSearch } },
        { alternatePhone: { contains: cleanSearch } },
        { aadhaarNumber:  { contains: cleanSearch } },
        { panNumber:      { contains: cleanSearch, mode: 'insensitive' } },
      ];
      if (tokens.length >= 2) {
        where.OR.push(
          {
            AND: tokens.map((token) => ({
              OR: [
                { firstName: { contains: token, mode: 'insensitive' } },
                { lastName: { contains: token, mode: 'insensitive' } },
              ],
            })),
          },
          {
            firstName: { contains: tokens[0], mode: 'insensitive' },
            lastName: { contains: tokens.slice(1).join(' '), mode: 'insensitive' },
          },
          {
            firstName: { contains: tokens.slice(0, -1).join(' '), mode: 'insensitive' },
            lastName: { contains: tokens[tokens.length - 1], mode: 'insensitive' },
          },
          {
            firstName: { contains: tokens.slice(1).join(' '), mode: 'insensitive' },
            lastName: { contains: tokens[0], mode: 'insensitive' },
          },
          {
            firstName: { contains: tokens[tokens.length - 1], mode: 'insensitive' },
            lastName: { contains: tokens.slice(0, -1).join(' '), mode: 'insensitive' },
          }
        );
      }
    }

    if (role === UserRole.EMPLOYEE && userId) {
      const empProfile = await this.prisma.employeeProfile.findFirst({
        where: { userId, tenantId },
        select: { id: true },
      });
      const validEmployeeIds = [userId];
      if (empProfile?.id) validEmployeeIds.push(empProfile.id);

      where.AND = [
        {
          OR: [
            { assignedEmployeeId: null },
            { assignedEmployeeId: { in: validEmployeeIds } },
            { policies: { some: { assignedEmployeeId: { in: validEmployeeIds } } } },
            { productInterests: { some: { assignedEmployeeId: { in: validEmployeeIds } } } },
            { claims: { some: { assignedEmployeeId: { in: validEmployeeIds } } } },
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
    if (query.role) where.role = query.role;

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take:    limitNum,
        orderBy: { [sortBy]: sortOrder },
        include: {
          addresses:   { where: { isPrimary: true }, take: 1 },
          occupations: { where: { isPrimary: true }, take: 1 },
          assignedEmployee: { select: { id: true, email: true, role: true, employeeProfile: { select: { firstName: true, lastName: true } } } },
          productInterests: { select: { id: true, leadId: true, stage: true, assignedEmployeeId: true, assignedEmployee: { select: { id: true, email: true, employeeProfile: { select: { firstName: true, lastName: true } } } } } },
          policies: { select: { id: true, status: true } },
          _count:      { select: { policies: true, documents: true } },
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { data, total, page: pageNum, limit: limitNum };
  }

  // ── Find single contact (with full relations) ───────────────────────────

  async findOne(tenantId: string, id: string) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const whereCondition: any = {
      tenantId,
      ...(isObjectId ? { OR: [{ id }, { contactId: id }] } : { contactId: id }),
    };

    const contact: any = await this.prisma.contact.findFirst({
      where: whereCondition,
      include: {
        addresses:     true,
        occupations:   true,
        assignedEmployee: { select: { id: true, email: true, role: true, employeeProfile: { select: { firstName: true, lastName: true } } } },
        relationships: {
          include: {
            relatedContact: {
              select: { id: true, firstName: true, middleName: true, lastName: true, phone: true, dateOfBirth: true, avatarUrl: true },
            },
          },
        },
        relatedTo: {
          include: {
            primaryContact: {
              select: { id: true, firstName: true, middleName: true, lastName: true, phone: true, dateOfBirth: true, avatarUrl: true },
            },
          },
        },
        documents:    { orderBy: { createdAt: 'desc' }, take: 10 },
        activityLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        policies: {
          where:   { deletedAt: null },
          include: {
            plan: { include: { company: true } },
            members: true,
            nominees: true,
          },
        },
        productInterests: {
          include: {
            consultations: { orderBy: { createdAt: 'desc' } }
          }
        },
        _count: { select: { policies: true, claims: true, documents: true } },
      },
    });

    if (contact && contact.id) {
      try {
        contact.relationships = await this.resolveFullFamilyRelationships(tenantId, contact);
      } catch (err: any) {
        // Fallback to existing relationships if cluster resolution fails
      }
    }

    return contact;
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
    const dob = parseSafeDate(dateOfBirth);
    const fuDate = parseSafeDate(followUpDate);
    return this.prisma.contact.create({
      data: {
        ...rest,
        tenantId,
        ...(dob ? { dateOfBirth: dob } : {}),
        ...(fuDate ? { followUpDate: fuDate } : {}),
      },
    });
  }

  // ── Update ──────────────────────────────────────────────────────────────

  async update(tenantId: string, id: string, dto: UpdateContactDto) {
    const { dateOfBirth, city, followUpDate, ...rest } = dto as any;
    const dob = parseSafeDate(dateOfBirth);
    const fuDate = parseSafeDate(followUpDate);
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const whereCondition: any = {
      tenantId,
      ...(isObjectId ? { OR: [{ id }, { contactId: id }] } : { contactId: id }),
    };
    return this.prisma.contact.updateMany({
      where: whereCondition,
      data: {
        ...rest,
        ...(dob ? { dateOfBirth: dob } : {}),
        ...(fuDate ? { followUpDate: fuDate } : {}),
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

  // ── Relationships (Bidirectional) ──────────────────────────────────────────

  resolveMemberGender(
    member: any,
    clusterContacts: any[] = [],
    clusterRels: any[] = [],
  ): 'MALE' | 'FEMALE' | null {
    if (!member) return null;
    const g = (member.gender || '').toUpperCase();
    if (g === 'MALE' || g === 'FEMALE') return g;

    if (Array.isArray(member.tags)) {
      if (member.tags.includes('gender:male')) return 'MALE';
      if (member.tags.includes('gender:female')) return 'FEMALE';
    }

    for (const r of clusterRels) {
      if (r.relatedContactId === member.id) {
        const t = (r.relationshipType || '').toUpperCase();
        if (['BROTHER', 'SON', 'FATHER'].includes(t)) return 'MALE';
        if (['SISTER', 'DAUGHTER', 'MOTHER'].includes(t)) return 'FEMALE';
      }
      if (r.primaryContactId === member.id && (r.relationshipType || '').toUpperCase() === 'SPOUSE') {
        const other = clusterContacts.find(c => c.id === r.relatedContactId);
        if (other) {
          const og = (other.gender || '').toUpperCase();
          if (og === 'MALE') return 'FEMALE';
          if (og === 'FEMALE') return 'MALE';
        }
      }
    }

    const fn = (member.firstName || '').toLowerCase().trim();
    const FEMALE_NAMES = new Set([
      'shivani', 'bhagyashree', 'pooja', 'swara', 'sumitra', 'rutuja', 'savita', 'neelima', 
      'alka', 'anita', 'anjali', 'archana', 'arti', 'aarti', 'ashwini', 'chhaya', 'deepa', 
      'deepika', 'geeta', 'jyoti', 'kamal', 'kavita', 'kiran', 'komal', 'lata', 'madhuri', 
      'mangala', 'manisha', 'meena', 'mohini', 'monika', 'neha', 'nirmala', 'pallavi', 
      'payal', 'poornima', 'pranita', 'pratibha', 'priti', 'preeti', 'priya', 'priyanka', 
      'radha', 'rekha', 'renuka', 'rohini', 'rupali', 'sangeeta', 'sangita', 'sarita', 
      'sayali', 'seema', 'sharda', 'sheetal', 'shital', 'shobha', 'shubhangi', 'smita', 
      'sneha', 'sonali', 'sujata', 'sunita', 'swati', 'tanuja', 'tejaswini', 'usha', 
      'vaishali', 'vandana', 'varsha', 'vidya', 'yogita', 'lakha', 'akka'
    ]);
    const MALE_NAMES = new Set([
      'shriram', 'ram', 'prajwal', 'shubham', 'amit', 'rahul', 'sachin', 'ajay', 'vijay', 
      'suresh', 'ramesh', 'mahesh', 'ganesh', 'rajesh', 'vikas', 'sandeep', 'santosh', 
      'deepak', 'pradeep', 'pravin', 'nitin', 'vishal', 'rohan', 'rohit', 'akshay', 
      'swapnil', 'amol', 'sagar', 'nilesh', 'chetan', 'mayur', 'tushar', 'saurabh', 
      'suraj', 'omkar', 'rushikesh', 'harshal', 'abhishek', 'aditya', 'prathamesh', 
      'sanket', 'gaurav', 'vaibhav', 'nikhil', 'aniket', 'kunal', 'sumit', 'mayuresh',
      'lalit', 'raju', 'rajnish', 'subhash', 'sushil', 'sampat', 'nishant', 'om'
    ]);
    if (FEMALE_NAMES.has(fn)) return 'FEMALE';
    if (MALE_NAMES.has(fn)) return 'MALE';
    return null;
  }

  getInverseRelationshipType(
    type: RelationshipType | string,
    primaryGender?: string | null,
    relatedGender?: string | null,
  ): RelationshipType {
    const upperType = (type || '').toUpperCase();
    const primaryIsMale = primaryGender?.toUpperCase() === 'MALE';
    const primaryIsFemale = primaryGender?.toUpperCase() === 'FEMALE';
    const relatedIsMale = relatedGender?.toUpperCase() === 'MALE';
    const relatedIsFemale = relatedGender?.toUpperCase() === 'FEMALE';

    switch (upperType) {
      case 'SPOUSE':
        return RelationshipType.SPOUSE;

      case 'SON':
      case 'DAUGHTER':
      case 'CHILD':
        // Primary is child, related is parent. In reverse, related is child, primary is parent.
        if (primaryIsMale) return RelationshipType.FATHER;
        if (primaryIsFemale) return RelationshipType.MOTHER;
        return RelationshipType.PARENT;

      case 'FATHER':
      case 'MOTHER':
      case 'PARENT':
        // Primary is parent, related is child. In reverse, related is parent, primary is child.
        if (primaryIsMale) return RelationshipType.SON;
        if (primaryIsFemale) return RelationshipType.DAUGHTER;
        return RelationshipType.CHILD;

      case 'BROTHER':
      case 'SISTER':
      case 'SIBLING':
        if (primaryIsMale) return RelationshipType.BROTHER;
        if (primaryIsFemale) return RelationshipType.SISTER;
        return RelationshipType.SIBLING;

      case 'IN_LAW':
        return RelationshipType.IN_LAW;

      default:
        return RelationshipType.OTHER;
    }
  }

  async addBidirectionalRelationship(
    primaryContact: any,
    relatedContact: any,
    relationshipType: RelationshipType,
  ) {
    const primaryContactId = primaryContact.id;
    const relatedContactId = relatedContact.id;

    const pGen = primaryContact.gender || this.resolveMemberGender(primaryContact, [primaryContact, relatedContact], []);
    const rGen = relatedContact.gender || this.resolveMemberGender(relatedContact, [primaryContact, relatedContact], []);

    let targetRelType = relationshipType;
    if (relationshipType === RelationshipType.SIBLING && rGen === 'MALE') targetRelType = RelationshipType.BROTHER;
    if (relationshipType === RelationshipType.SIBLING && rGen === 'FEMALE') targetRelType = RelationshipType.SISTER;

    const inverseType = this.getInverseRelationshipType(
      targetRelType,
      pGen,
      rGen,
    );

    return this.prisma.$transaction(async (tx) => {
      const existingForward = await tx.contactRelationship.findUnique({
        where: {
          primaryContactId_relatedContactId: {
            primaryContactId,
            relatedContactId,
          },
        },
      });

      let forward: any;
      if (existingForward) {
        forward = await tx.contactRelationship.update({
          where: { id: existingForward.id },
          data: { relationshipType },
          include: {
            relatedContact: { select: { id: true, firstName: true, lastName: true, phone: true, dateOfBirth: true } },
          },
        });
      } else {
        forward = await tx.contactRelationship.create({
          data: {
            primaryContactId,
            relatedContactId,
            relationshipType,
          },
          include: {
            relatedContact: { select: { id: true, firstName: true, lastName: true, phone: true, dateOfBirth: true } },
          },
        });
      }

      const existingReverse = await tx.contactRelationship.findUnique({
        where: {
          primaryContactId_relatedContactId: {
            primaryContactId: relatedContactId,
            relatedContactId: primaryContactId,
          },
        },
      });

      if (existingReverse) {
        await tx.contactRelationship.update({
          where: { id: existingReverse.id },
          data: { relationshipType: inverseType },
        });
      } else {
        await tx.contactRelationship.create({
          data: {
            primaryContactId: relatedContactId,
            relatedContactId: primaryContactId,
            relationshipType: inverseType,
          },
        });
      }

      return forward;
    });
  }

  deduceRelationship(
    memberA: any,
    memberB: any,
    clusterContacts: any[],
    clusterRels: any[],
  ): RelationshipType {
    const aId = memberA.id;
    const bId = memberB.id;
    const genA = this.resolveMemberGender(memberA, clusterContacts, clusterRels);
    const genB = this.resolveMemberGender(memberB, clusterContacts, clusterRels);

    // 1. Direct relationship
    const direct = clusterRels.find(r => r.primaryContactId === aId && r.relatedContactId === bId);
    if (direct) {
      if (direct.relationshipType === RelationshipType.SIBLING && genB === 'MALE') return RelationshipType.BROTHER;
      if (direct.relationshipType === RelationshipType.SIBLING && genB === 'FEMALE') return RelationshipType.SISTER;
      if (direct.relationshipType === RelationshipType.PARENT && genB === 'MALE') return RelationshipType.FATHER;
      if (direct.relationshipType === RelationshipType.PARENT && genB === 'FEMALE') return RelationshipType.MOTHER;
      if (direct.relationshipType === RelationshipType.CHILD && genB === 'MALE') return RelationshipType.SON;
      if (direct.relationshipType === RelationshipType.CHILD && genB === 'FEMALE') return RelationshipType.DAUGHTER;
      if (direct.relationshipType !== RelationshipType.OTHER) return direct.relationshipType;
    }

    const reverse = clusterRels.find(r => r.primaryContactId === bId && r.relatedContactId === aId);
    if (reverse && reverse.relationshipType !== RelationshipType.OTHER) {
      const inv = this.getInverseRelationshipType(reverse.relationshipType, genB, genA);
      if (inv !== RelationshipType.OTHER) return inv;
    }

    const isParentRel = (t: string) => ['FATHER', 'MOTHER', 'PARENT'].includes((t || '').toUpperCase());
    const isChildRel = (t: string) => ['SON', 'DAUGHTER', 'CHILD'].includes((t || '').toUpperCase());
    const isSpouseRel = (t: string) => (t || '').toUpperCase() === 'SPOUSE';
    const isSiblingRel = (t: string) => ['BROTHER', 'SISTER', 'SIBLING'].includes((t || '').toUpperCase());

    const getParents = (id: string) => {
      const parents = new Set<string>();
      clusterRels.forEach(r => {
        if (r.primaryContactId === id && isParentRel(r.relationshipType)) parents.add(r.relatedContactId);
        if (r.relatedContactId === id && isChildRel(r.relationshipType)) parents.add(r.primaryContactId);
      });
      return Array.from(parents);
    };

    const getChildren = (id: string) => {
      const children = new Set<string>();
      clusterRels.forEach(r => {
        if (r.primaryContactId === id && isChildRel(r.relationshipType)) children.add(r.relatedContactId);
        if (r.relatedContactId === id && isParentRel(r.relationshipType)) children.add(r.primaryContactId);
      });
      return Array.from(children);
    };

    const getSpouses = (id: string) => {
      const spouses = new Set<string>();
      clusterRels.forEach(r => {
        if (r.primaryContactId === id && isSpouseRel(r.relationshipType)) spouses.add(r.relatedContactId);
        if (r.relatedContactId === id && isSpouseRel(r.relationshipType)) spouses.add(r.primaryContactId);
      });
      return Array.from(spouses);
    };

    const getFullSiblingGroup = (startId: string) => {
      const group = new Set<string>([startId]);
      const queue = [startId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        clusterRels.forEach(r => {
          if (r.primaryContactId === curr && isSiblingRel(r.relationshipType) && !group.has(r.relatedContactId)) {
            group.add(r.relatedContactId);
            queue.push(r.relatedContactId);
          }
          if (r.relatedContactId === curr && isSiblingRel(r.relationshipType) && !group.has(r.primaryContactId)) {
            group.add(r.primaryContactId);
            queue.push(r.primaryContactId);
          }
        });
      }
      return group;
    };

    const parentsA = getParents(aId);
    const parentsB = getParents(bId);
    const childrenA = getChildren(aId);
    const childrenB = getChildren(bId);
    const spousesA = getSpouses(aId);

    // 1. Is B spouse of A?
    if (spousesA.includes(bId)) return RelationshipType.SPOUSE;

    // 2. Common child => spouse
    const commonChildren = childrenA.filter(c => childrenB.includes(c));
    if (commonChildren.length > 0) return RelationshipType.SPOUSE;

    // 3. Is B parent of A?
    if (parentsA.includes(bId)) {
      if (genB === 'MALE') return RelationshipType.FATHER;
      if (genB === 'FEMALE') return RelationshipType.MOTHER;
      return RelationshipType.PARENT;
    }

    // 4. Is B spouse of any of A's parents?
    for (const p of parentsA) {
      if (getSpouses(p).includes(bId)) {
        if (genB === 'MALE') return RelationshipType.FATHER;
        if (genB === 'FEMALE') return RelationshipType.MOTHER;
        return RelationshipType.PARENT;
      }
    }

    // 5. Parent-Child transitivity through Siblings:
    // If A's sibling S has B as parent -> B is parent of A!
    const sibsA = Array.from(getFullSiblingGroup(aId));
    for (const s of sibsA) {
      if (s === aId) continue;
      if (getParents(s).includes(bId)) {
        if (genB === 'MALE') return RelationshipType.FATHER;
        if (genB === 'FEMALE') return RelationshipType.MOTHER;
        return RelationshipType.PARENT;
      }
    }

    // 6. Is B child of A?
    if (childrenA.includes(bId)) {
      if (genB === 'MALE') return RelationshipType.SON;
      if (genB === 'FEMALE') return RelationshipType.DAUGHTER;
      return RelationshipType.CHILD;
    }

    // 7. Is B child of A's spouse?
    for (const sp of spousesA) {
      if (getChildren(sp).includes(bId)) {
        if (genB === 'MALE') return RelationshipType.SON;
        if (genB === 'FEMALE') return RelationshipType.DAUGHTER;
        return RelationshipType.CHILD;
      }
    }

    // 8. If B is sibling of any of A's children -> B is child of A!
    for (const ch of childrenA) {
      if (getFullSiblingGroup(ch).has(bId)) {
        if (genB === 'MALE') return RelationshipType.SON;
        if (genB === 'FEMALE') return RelationshipType.DAUGHTER;
        return RelationshipType.CHILD;
      }
    }

    // 9. Sibling Transitivity:
    // If A and B are in the same sibling group (directly or transitively connected via brother/sister/sibling)
    if (getFullSiblingGroup(aId).has(bId)) {
      if (genB === 'MALE') return RelationshipType.BROTHER;
      if (genB === 'FEMALE') return RelationshipType.SISTER;
      return RelationshipType.SIBLING;
    }

    // 10. Do A and B share a parent? (Siblings)
    const commonParents = parentsA.filter(p => parentsB.includes(p));
    if (commonParents.length > 0) {
      if (genB === 'MALE') return RelationshipType.BROTHER;
      if (genB === 'FEMALE') return RelationshipType.SISTER;
      return RelationshipType.SIBLING;
    }

    // 11. Half-siblings through parent's spouse
    for (const p of parentsA) {
      for (const sp of getSpouses(p)) {
        if (getChildren(sp).includes(bId)) {
          if (genB === 'MALE') return RelationshipType.BROTHER;
          if (genB === 'FEMALE') return RelationshipType.SISTER;
          return RelationshipType.SIBLING;
        }
      }
    }

    return RelationshipType.OTHER;
  }

  async interconnectFamilyCluster(tenantId: string, seedContactId: string): Promise<void> {
    if (!seedContactId) return;

    // 1. BFS to discover all connected contact IDs in this family network
    const visited = new Set<string>([seedContactId]);
    const queue = [seedContactId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const rels = await this.prisma.contactRelationship.findMany({
        where: {
          OR: [
            { primaryContactId: currentId },
            { relatedContactId: currentId },
          ],
        },
        select: { primaryContactId: true, relatedContactId: true },
      });

      for (const r of rels) {
        if (!visited.has(r.primaryContactId)) {
          visited.add(r.primaryContactId);
          queue.push(r.primaryContactId);
        }
        if (!visited.has(r.relatedContactId)) {
          visited.add(r.relatedContactId);
          queue.push(r.relatedContactId);
        }
      }
    }

    if (visited.size <= 1) return;

    const allClusterIds = Array.from(visited);

    // 2. Fetch all members and all existing relationship edges between them
    const [clusterContacts, clusterRels] = await Promise.all([
      this.prisma.contact.findMany({
        where: { id: { in: allClusterIds }, tenantId },
        select: {
          id: true,
          gender: true,
          firstName: true,
          lastName: true,
          tags: true,
        },
      }),
      this.prisma.contactRelationship.findMany({
        where: {
          primaryContactId: { in: allClusterIds },
          relatedContactId: { in: allClusterIds },
        },
      }),
    ]);

    const contactMap = new Map(clusterContacts.map(c => [c.id, c]));

    // 3. For every pair of members (A, B) in the cluster, check if direct edge exists or needs updating
    for (let i = 0; i < allClusterIds.length; i++) {
      for (let j = 0; j < allClusterIds.length; j++) {
        if (i === j) continue;
        const idA = allClusterIds[i];
        const idB = allClusterIds[j];
        const memberA = contactMap.get(idA);
        const memberB = contactMap.get(idB);
        if (!memberA || !memberB) continue;

        // Auto-heal missing gender on members in DB
        const genA = this.resolveMemberGender(memberA, clusterContacts, clusterRels);
        const genB = this.resolveMemberGender(memberB, clusterContacts, clusterRels);
        if (!memberA.gender && genA) {
          memberA.gender = genA;
          await this.prisma.contact.update({ where: { id: idA }, data: { gender: genA as any } }).catch(() => {});
        }
        if (!memberB.gender && genB) {
          memberB.gender = genB;
          await this.prisma.contact.update({ where: { id: idB }, data: { gender: genB as any } }).catch(() => {});
        }

        const directEdge = clusterRels.find(
          r => r.primaryContactId === idA && r.relatedContactId === idB,
        );

        const deducedType = this.deduceRelationship(memberA, memberB, clusterContacts, clusterRels);
        const inverseType = this.getInverseRelationshipType(deducedType, genA, genB);

        // If no edge exists OR edge is generic/incorrect (e.g. OTHER or SIBLING when specific BROTHER/SISTER is known)
        const needsUpdate = !directEdge ||
          (directEdge.relationshipType === RelationshipType.OTHER && deducedType !== RelationshipType.OTHER) ||
          (directEdge.relationshipType === RelationshipType.SIBLING && (deducedType === RelationshipType.BROTHER || deducedType === RelationshipType.SISTER)) ||
          (directEdge.relationshipType === RelationshipType.PARENT && (deducedType === RelationshipType.FATHER || deducedType === RelationshipType.MOTHER)) ||
          (directEdge.relationshipType === RelationshipType.CHILD && (deducedType === RelationshipType.SON || deducedType === RelationshipType.DAUGHTER));

        if (needsUpdate && deducedType !== RelationshipType.OTHER) {
          try {
            await this.prisma.contactRelationship.upsert({
              where: {
                primaryContactId_relatedContactId: {
                  primaryContactId: idA,
                  relatedContactId: idB,
                },
              },
              update: { relationshipType: deducedType },
              create: {
                primaryContactId: idA,
                relatedContactId: idB,
                relationshipType: deducedType,
              },
            });

            // Also ensure reverse edge exists
            await this.prisma.contactRelationship.upsert({
              where: {
                primaryContactId_relatedContactId: {
                  primaryContactId: idB,
                  relatedContactId: idA,
                },
              },
              update: { relationshipType: inverseType },
              create: {
                primaryContactId: idB,
                relatedContactId: idA,
                relationshipType: inverseType,
              },
            });

            // Keep local cache updated for subsequent pairwise deductions
            const existingFwd = clusterRels.find(r => r.primaryContactId === idA && r.relatedContactId === idB);
            if (existingFwd) {
              existingFwd.relationshipType = deducedType;
            } else {
              clusterRels.push({
                id: `synced_${idA}_${idB}`,
                primaryContactId: idA,
                relatedContactId: idB,
                relationshipType: deducedType,
                createdAt: new Date(),
              } as any);
            }

            const existingRev = clusterRels.find(r => r.primaryContactId === idB && r.relatedContactId === idA);
            if (existingRev) {
              existingRev.relationshipType = inverseType;
            } else {
              clusterRels.push({
                id: `synced_${idB}_${idA}`,
                primaryContactId: idB,
                relatedContactId: idA,
                relationshipType: inverseType,
                createdAt: new Date(),
              } as any);
            }
          } catch (e: any) {
            // Ignore unique constraint race conditions
          }
        }
      }
    }
  }

  async resolveFullFamilyRelationships(tenantId: string, contact: any) {
    if (!contact || !contact.id) return contact?.relationships || [];

    // First auto-heal and persist all interconnected cluster edges
    try {
      await this.interconnectFamilyCluster(tenantId, contact.id);
    } catch (err: any) {
      // Continue even if cluster interconnection encounters an issue
    }

    // Now reload all direct relationships from DB
    const freshRelationships = await this.prisma.contactRelationship.findMany({
      where: { primaryContactId: contact.id },
      include: {
        relatedContact: {
          select: {
            id: true,
            contactId: true,
            firstName: true,
            middleName: true,
            lastName: true,
            phone: true,
            alternatePhone: true,
            dateOfBirth: true,
            gender: true,
            maritalStatus: true,
            education: true,
            weddingAnniversaryDate: true,
            height: true,
            weight: true,
            medicalHistory: true,
            declaredMedicalHistory: true,
            notDeclaredMedicalHistory: true,
            medicalHistoryDetails: true,
            surgeryDetails: true,
            prescriptionDetails: true,
            avatarUrl: true,
            tags: true,
            notes: true,
            occupations: true,
            addresses: true,
            assignedEmployeeId: true,
            assignedEmployee: { select: { id: true, email: true, role: true, employeeProfile: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });

    return freshRelationships;
  }

  async removeBidirectionalRelationship(primaryContactId: string, relationshipId: string, tenantId: string) {
    await this.prisma.contact.findFirstOrThrow({ where: { id: primaryContactId, tenantId } });

    let pId: string | undefined;
    let rId: string | undefined;

    const existing = await this.prisma.contactRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (existing) {
      pId = existing.primaryContactId;
      rId = existing.relatedContactId;
    } else if (relationshipId && relationshipId.startsWith('cluster_')) {
      const parts = relationshipId.split('_');
      pId = parts[1];
      rId = parts[2];
    } else if (relationshipId && /^[0-9a-fA-F]{24}$/.test(relationshipId)) {
      pId = primaryContactId;
      rId = relationshipId;
    }

    if (pId && rId) {
      await this.prisma.$transaction(async (tx) => {
        await tx.contactRelationship.deleteMany({
          where: {
            OR: [
              { primaryContactId: pId, relatedContactId: rId },
              { primaryContactId: rId, relatedContactId: pId },
            ],
          },
        });
      });
    }
  }

  async addRelationship(primaryContactId: string, tenantId: string, dto: CreateRelationshipDto) {
    const primaryContact = await this.prisma.contact.findFirstOrThrow({ where: { id: primaryContactId, tenantId } });
    const relatedContact = await this.prisma.contact.findFirstOrThrow({ where: { id: dto.relatedContactId!, tenantId } });
    return this.addBidirectionalRelationship(primaryContact, relatedContact, dto.relationshipType);
  }

  async removeRelationship(primaryContactId: string, relationshipId: string, tenantId: string) {
    return this.removeBidirectionalRelationship(primaryContactId, relationshipId, tenantId);
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
    return this.prisma.contact.count({ where: { tenantId, isActive: true, relatedTo: { none: {} } } });
  }

  async getStats(tenantId: string) {
    const today        = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [total, addedThisMonth, byGender] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId, isActive: true, relatedTo: { none: {} } } }),
      this.prisma.contact.count({
        where: { tenantId, isActive: true, createdAt: { gte: startOfMonth }, relatedTo: { none: {} } },
      }),
      this.prisma.contact.groupBy({
        by:     ['gender'],
        where:  { tenantId, isActive: true, relatedTo: { none: {} } },
        _count: true,
      }),
    ]);

    return { total, addedThisMonth, byGender };
  }

  async upcomingBirthdays(tenantId: string, days = 30) {
    const today    = new Date();
    const contacts = await this.prisma.contact.findMany({
      where:  { tenantId, isActive: true, dateOfBirth: { not: null }, relatedTo: { none: {} } },
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
      where:   { tenantId, isActive: true, relatedTo: { none: {} } },
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
