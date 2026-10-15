// ─────────────────────────────────────────────────────────────────────────────
// Contacts Service — business logic layer
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { ContactsRepository, parseSafeDate } from './contacts.repository';
import { PrismaService }      from '../../database/prisma.service';
import { EmailService }       from '../../common/email/email.service';
import * as bcrypt from 'bcryptjs';
import { UserRole }           from '@prisma/client';
import { ClaimStatus, LeadStage, PaymentFrequency, PolicyStatus } from '@prisma/client';
import {
  CreateContactDto, UpdateContactDto,
  CreateAddressDto, CreateOccupationDto,
  CreateRelationshipDto, ContactFilterDto,
  BulkTagDto, BulkDeleteDto,
} from './dto/contact.dto';

import { NotificationEngineService } from '../notifications/notification-engine.service';
import { activityValuesDiffer, formatActivityChange } from '../../common/utils/activity-change.util';

interface BulkImportContact {
  rowNumber?: number;
  contact: CreateContactDto;
  importErrors?: string[];
  address?: CreateAddressDto;
  occupation?: CreateOccupationDto;
  productInterests?: Array<{
    importErrors?: string[];
    interests?: string[];
    source?: string;
    stage?: string;
    leadStatus?: string;
    leadType?: string;
    dependencyType?: string;
    dependentDetails?: string;
    descriptionDetails?: string;
    followUpDate?: string;
    premiumBudget?: number;
    sumAssuredRequired?: number;
    notes?: string;
  }>;
  familyMembers?: Array<CreateRelationshipDto & { occupation?: string }>;
  policies?: Array<{
    importErrors?: string[];
    policyNumber?: string;
    planName?: string;
    status?: string;
    sumAssured?: number;
    premiumAmount?: number;
    paymentFrequency?: string;
    startDate?: string;
    endDate?: string;
    maturityDate?: string;
    nextDueDate?: string;
    agentCode?: string;
    notes?: string;
  }>;
  claims?: Array<{
    importErrors?: string[];
    claimNumber?: string;
    policyNumber?: string;
    claimType?: string;
    claimAmount?: number;
    approvedAmount?: number;
    intimatedAt?: string;
    filedAt?: string;
    settledAt?: string;
    status?: string;
    notes?: string;
    rejectionReason?: string;
  }>;
}

@Injectable()
export class ContactsService implements OnModuleInit {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private readonly repo:   ContactsRepository,
    private readonly prisma: PrismaService,
    private readonly email:  EmailService,
    private readonly notifEngine: NotificationEngineService,
  ) {}

  async onModuleInit() {
    await this.initializeContactIds();
  }

  /** Generate atomic sequential Contact ID C1, C2... using MongoDB counter */
  async getNextContactId(): Promise<string> {
    try {
      const counter = await this.prisma.counter.upsert({
        where: { id: 'contact_id_seq' },
        update: { seq: { increment: 1 } },
        create: { id: 'contact_id_seq', seq: 1 },
      });
      return `C${counter.seq}`;
    } catch (err: any) {
      this.logger.error(`Error generating atomic Contact ID: ${err.message}`);
      const res: any = await this.prisma.$runCommandRaw({
        findAndModify: 'counters',
        query: { _id: 'contact_id_seq' },
        update: { $inc: { seq: 1 } },
        new: true,
        upsert: true,
      });
      const seq = res?.value?.seq ?? res?.seq ?? 1;
      return `C${seq}`;
    }
  }

  /** Assign sequential IDs C1, C2... to pre-existing contacts safely without duplicates */
  async initializeContactIds(): Promise<void> {
    try {
      const allContacts = await this.prisma.contact.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true, contactId: true },
      });

      const unassignedContacts = allContacts.filter(c => !(c as any).contactId);

      if (unassignedContacts.length > 0) {
        this.logger.log(`Found ${unassignedContacts.length} existing contacts without Contact ID. Assigning sequential IDs...`);
        for (const contact of unassignedContacts) {
          const nextId = await this.getNextContactId();
          await this.prisma.contact.update({
            where: { id: contact.id },
            data: { contactId: nextId } as any,
          });
        }
        this.logger.log(`Successfully backfilled Contact IDs for ${unassignedContacts.length} existing contacts.`);
      }
    } catch (err: any) {
      this.logger.warn(`Initialize Contact IDs error: ${err.message}`);
    }
  }

  async findAll(tenantId: string, query: ContactFilterDto, userId?: string, role?: UserRole) {
    await this.initializeContactIds();
    const result = await this.repo.findAll(tenantId, query, userId, role);
    return {
      data:    result.data,
      message: 'Contacts retrieved',
      meta: {
        total:       result.total,
        page:        result.page,
        limit:       result.limit,
        totalPages:  Math.ceil(result.total / result.limit),
      },
    };
  }

  async findOne(tenantId: string, id: string, userId?: string, role?: UserRole) {
    if (role === UserRole.EMPLOYEE && userId) {
      await this.checkContactAccess(tenantId, id, userId, role);
    }
    const contact = await this.repo.findOne(tenantId, id);
    if (!contact) throw new NotFoundException(`Contact ${id} not found`);
    return { data: contact };
  }

  async create(tenantId: string, dto: CreateContactDto, createdById: string, role?: UserRole) {
    if (!dto.phone || !dto.phone.trim()) {
      if (dto.isDependent) {
        dto.phone = `00${Date.now().toString().slice(-8)}`;
      } else {
        dto.phone = '0000000000';
      }
    }

    // Duplicate phone check (within same tenant)
    if (dto.phone !== '0000000000' && !dto.phone.startsWith('00')) {
      const existing = await this.repo.findByPhone(tenantId, dto.phone);
      if (existing) {
        if (!existing.isActive) {
          throw new ConflictException(
            `A contact with phone ${dto.phone} already exists.`,
          );
        }
        throw new ConflictException(`A contact with phone ${dto.phone} already exists`);
      }
    }

    if (role === UserRole.EMPLOYEE) {
      dto.assignedEmployeeId = createdById;
    }

    const nextContactId = await this.getNextContactId();
    const contact = await this.repo.create(tenantId, { ...dto, contactId: nextContactId } as any);

    // Create primary Address if city is provided
    if (dto.city) {
      await this.repo.addAddress(contact.id, tenantId, {
        type: 'HOME',
        line1: 'N/A',
        city: dto.city,
        state: 'N/A',
        pincode: 'N/A',
        country: 'India',
        isPrimary: true,
      }).catch(err => this.logger.warn(`Failed to auto-create address: ${err.message}`));
    }

    // Log activity (non-critical — swallow errors so contact creation always succeeds)
    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          userId:     createdById,
          contactId:  contact.id,
          entityType: 'Contact',
          entityId:   contact.id,
          action:     'CREATE',
          description: `Contact ${contact.firstName} ${contact.lastName} created`,
        },
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed for contact ${contact.id}: ${err.message}`);
    }

    if (dto.assignedEmployeeId) {
      let targetUserId = dto.assignedEmployeeId;
      const empProfile = await this.prisma.employeeProfile.findFirst({
        where: { OR: [{ id: dto.assignedEmployeeId }, { userId: dto.assignedEmployeeId }], tenantId },
        select: { userId: true },
      });
      if (empProfile?.userId) {
        targetUserId = empProfile.userId;
      }

      const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
      await this.notifEngine.notifyAssignment({
        tenantId,
        assignerId: createdById,
        assigneeId: targetUserId,
        recordType: 'Contact',
        recordId: contact.id,
        recordName: contactName || 'Contact',
      }).catch(err => this.logger.warn(`Failed sending contact assignment notification: ${err.message}`));
    }

    return { data: contact, message: 'Contact created successfully' };
  }

  async update(tenantId: string, id: string, dto: UpdateContactDto, updatedById: string, role?: UserRole) {
    if (role === UserRole.EMPLOYEE) {
      await this.checkContactAccess(tenantId, id, updatedById, role);
    }
    const existing = await this.repo.findOne(tenantId, id);
    if (!existing) throw new NotFoundException(`Contact ${id} not found`);

    const targetId = existing.id;
    const fieldLabels: Record<string, string> = {
      firstName: 'First Name',
      middleName: 'Middle Name',
      lastName: 'Last Name',
      birthPlace: 'Birth Place',
      phone: 'WhatsApp Number',
      alternatePhone: 'Calling Number',
      email: 'Email',
      gender: 'Gender',
      dateOfBirth: 'Date of Birth',
      maritalStatus: 'Marital Status',
      weddingAnniversaryDate: 'Wedding Anniversary',
      education: 'Education',
      annualIncome: 'Annual Income',
      height: 'Height',
      weight: 'Weight',
      panNumber: 'PAN Number',
      aadhaarNumber: 'Aadhaar Number',
      occupation: 'Occupation',
      city: 'Address',
      state: 'State',
      district: 'District',
      pincode: 'Pincode',
      notes: 'Notes',
      isActive: 'Contact Status',
      isDependent: 'Dependent Status',
      dependentNo: 'Guardian WhatsApp Number',
      medicalHistory: 'Medical History',
      declaredMedicalHistory: 'Declared Medical History',
      notDeclaredMedicalHistory: 'Undeclared Medical History',
      medicalHistoryDetails: 'Medical History Details',
      chewTobacco: 'Tobacco Use',
      smoke: 'Smoking',
      consumeAlcohol: 'Alcohol Use',
      surgeryDetails: 'Surgery Details',
      prescriptionDetails: 'Prescription Details',
      role: 'Role',
      tags: 'Tags',
      source: 'Source',
      assignedEmployeeId: 'Assigned Employee',
      leadStage: 'Lead Stage',
      leadStatus: 'Lead Status',
      leadType: 'Lead Type',
      followUpDate: 'Follow-up Date',
    };
    const changedFields = Object.keys(dto).filter((key) => {
      if (!(key in fieldLabels)) return false;
      const oldValue = (existing as any)[key];
      const newValue = (dto as any)[key];
      return activityValuesDiffer(key, oldValue, newValue);
    });
    await this.repo.update(tenantId, targetId, dto);

    if (changedFields.length > 0) {
      const familyRelationships = await this.prisma.contactRelationship.findMany({
        where: { relatedContactId: targetId },
        include: {
          primaryContact: { select: { id: true, tenantId: true } },
        },
      });
      const memberName = `${existing.firstName || ''} ${existing.lastName || ''}`.trim() || 'Family member';
      for (const relationship of familyRelationships) {
        if (relationship.primaryContact.tenantId !== tenantId || relationship.primaryContact.id === targetId) continue;
        try {
          await this.prisma.activityLog.create({
            data: {
              tenantId,
              userId: updatedById,
              contactId: relationship.primaryContact.id,
              entityType: 'Contact',
              entityId: relationship.primaryContact.id,
              action: 'UPDATE',
              description: `Family member ${memberName} updated: ${changedFields
                .map(key => formatActivityChange(key, fieldLabels[key], (existing as any)[key], (dto as any)[key]))
                .join('; ')}`,
            },
          });
        } catch (err: any) {
          this.logger.warn(`ActivityLog write failed for family member ${targetId}: ${err.message}`);
        }
      }
    }

    // Create/update primary Address if city is provided
    if (dto.city) {
      await this.repo.addAddress(targetId, tenantId, {
        type: 'HOME',
        line1: 'N/A',
        city: dto.city,
        state: 'N/A',
        pincode: 'N/A',
        country: 'India',
        isPrimary: true,
      }).catch(err => this.logger.warn(`Failed to auto-update address: ${err.message}`));
    }

    // Log activity (non-critical)
    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          userId:     updatedById,
          contactId:  targetId,
          entityType: 'Contact',
          entityId:   targetId,
          action:     'UPDATE',
          description: changedFields.length
            ? `Personal details updated: ${changedFields
              .map(key => formatActivityChange(key, fieldLabels[key], (existing as any)[key], (dto as any)[key]))
              .join('; ')}`
            : 'Contact details saved; no tracked fields changed',
        },
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed for contact ${targetId}: ${err.message}`);
    }

    const updated = await this.repo.findOne(tenantId, targetId);

    if (dto.assignedEmployeeId && dto.assignedEmployeeId !== existing.assignedEmployeeId) {
      let targetUserId = dto.assignedEmployeeId;
      const empProfile = await this.prisma.employeeProfile.findFirst({
        where: { OR: [{ id: dto.assignedEmployeeId }, { userId: dto.assignedEmployeeId }], tenantId },
        select: { userId: true },
      });
      if (empProfile?.userId) {
        targetUserId = empProfile.userId;
      }

      const contactName = updated ? `${updated.firstName || ''} ${updated.lastName || ''}`.trim() : 'Contact';
      await this.notifEngine.notifyAssignment({
        tenantId,
        assignerId: updatedById,
        assigneeId: targetUserId,
        recordType: 'Contact',
        recordId: id,
        recordName: contactName || 'Contact',
      }).catch(err => this.logger.warn(`Failed sending contact assignment notification: ${err.message}`));
    }

    return { data: updated, message: 'Contact updated successfully' };
  }

  async remove(tenantId: string, id: string, userId?: string) {
    const existing = await this.repo.findOne(tenantId, id);
    if (!existing) throw new NotFoundException(`Contact ${id} not found`);
    await this.repo.remove(tenantId, id);
    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          userId,
          entityType: 'Contact',
          entityId: id,
          action: 'DELETE',
          description: 'Admin directly deleted the contact',
        }
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed for contact delete: ${err.message}`);
    }
    return { data: null, message: 'Contact deleted successfully' };
  }

  // ── Addresses ────────────────────────────────────────────────────────────

  async addAddress(tenantId: string, contactId: string, dto: CreateAddressDto, userId?: string) {
    const address = await this.repo.addAddress(contactId, tenantId, dto);
    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          userId,
          contactId,
          entityType: 'Contact',
          entityId: address.id,
          action: 'UPDATE',
          description: `Address details updated: ${[dto.line1, dto.city, dto.state, dto.pincode].filter(Boolean).join(', ')}`,
        },
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed for address: ${err.message}`);
    }
    return { data: address, message: 'Address added' };
  }

  async removeAddress(tenantId: string, contactId: string, addressId: string, userId?: string) {
    const address = await this.prisma.address.findFirst({ where: { id: addressId, contactId } });
    await this.repo.removeAddress(contactId, addressId, tenantId);
    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          userId,
          contactId,
          entityType: 'Contact',
          entityId: contactId,
          action: 'UPDATE',
          description: `Contact address removed${address ? `: ${[address.line1, address.city, address.state, address.pincode].filter(Boolean).join(', ')}` : ''}`,
        },
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed for address remove: ${err.message}`);
    }
    return { data: null, message: 'Address removed' };
  }

  // ── Occupations ──────────────────────────────────────────────────────────

  async addOccupation(tenantId: string, contactId: string, dto: CreateOccupationDto, userId?: string) {
    const occ = await this.repo.addOccupation(contactId, tenantId, dto);
    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          userId,
          contactId,
          entityType: 'Contact',
          entityId: occ.id,
          action: 'UPDATE',
          description: `Occupation details updated: ${dto.companyName ? `${dto.companyName} (${dto.type || 'SALARIED'})` : (dto.type || 'SALARIED')}`,
        },
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed for occupation: ${err.message}`);
    }
    return { data: occ, message: 'Occupation added' };
  }

  async removeOccupation(tenantId: string, contactId: string, occupationId: string, userId?: string) {
    const occupation = await this.prisma.occupation.findFirst({ where: { id: occupationId, contactId } });
    await this.repo.removeOccupation(contactId, occupationId, tenantId);
    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          userId,
          contactId,
          entityType: 'Contact',
          entityId: contactId,
          action: 'UPDATE',
          description: `Contact occupation removed${occupation ? `: ${occupation.companyName ? `${occupation.companyName} (${occupation.type})` : occupation.type}` : ''}`,
        },
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed for occupation remove: ${err.message}`);
    }
    return { data: null, message: 'Occupation removed' };
  }

  // ── Relationships ─────────────────────────────────────────────────────────

  async addRelationship(tenantId: string, contactId: string, dto: CreateRelationshipDto, userId?: string) {
    if (dto.relatedContactId === contactId) {
      throw new BadRequestException('A contact cannot be related to itself');
    }

    let relType = (dto.relationshipType || 'OTHER').toUpperCase() as any;
    const validEnums = ['SELF', 'SPOUSE', 'CHILD', 'SON', 'DAUGHTER', 'PARENT', 'FATHER', 'MOTHER', 'SIBLING', 'BROTHER', 'SISTER', 'IN_LAW', 'OTHER'];
    if (!validEnums.includes(relType)) {
      relType = 'OTHER';
    }

    const primaryContact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });
    if (!primaryContact) {
      throw new NotFoundException(`Contact ${contactId} not found`);
    }

    let targetRelatedContactId = dto.relatedContactId;

    if (!targetRelatedContactId) {
      const rawName = (dto.name || '').trim();
      const phone = (dto.phone || '').trim();

      const nameParts = rawName.split(' ').filter(Boolean);
      const firstName = dto.firstName?.trim() || nameParts[0] || 'Family Member';
      const middleName = dto.middleName?.trim() || '';
      const lastName = dto.lastName?.trim() || nameParts.slice(1).join(' ') || '';

      let existing: any = null;
      if (phone && phone !== '0000000000' && !phone.startsWith('00')) {
        existing = await this.repo.findByPhone(tenantId, phone);
      }

      if (!existing && rawName) {
        existing = await this.prisma.contact.findFirst({
          where: {
            tenantId,
            id: { not: contactId },
            isActive: true,
            OR: [
              {
                firstName: { equals: firstName, mode: 'insensitive' },
                ...(lastName ? { lastName: { equals: lastName, mode: 'insensitive' } } : {}),
              },
              {
                firstName: { equals: rawName, mode: 'insensitive' },
              },
            ],
          },
        });
      }

      if (existing) {
        targetRelatedContactId = existing.id;
      } else {
        let inferredGender: any = undefined;
        if (dto.gender && ['MALE', 'FEMALE', 'OTHER'].includes(dto.gender.toUpperCase())) {
          inferredGender = dto.gender.toUpperCase();
        } else if (['SON', 'FATHER', 'BROTHER'].includes(relType)) {
          inferredGender = 'MALE';
        } else if (['DAUGHTER', 'MOTHER', 'SISTER'].includes(relType)) {
          inferredGender = 'FEMALE';
        }

        const nextContactId = await this.getNextContactId();
        const newContact = await this.repo.create(tenantId, {
          firstName,
          middleName,
          lastName,
          phone: phone || `00${Date.now().toString().slice(-8)}`,
          alternatePhone: dto.alternatePhone,
          dateOfBirth: dto.dateOfBirth,
          gender: inferredGender,
          maritalStatus: dto.maritalStatus,
          weddingAnniversaryDate: dto.weddingAnniversaryDate,
          education: dto.education,
          height: dto.height,
          weight: dto.weight,
          medicalHistory: dto.medicalHistory,
          declaredMedicalHistory: dto.declaredMedicalHistory,
          notDeclaredMedicalHistory: dto.notDeclaredMedicalHistory,
          medicalHistoryDetails: dto.medicalHistoryDetails,
          surgeryDetails: dto.surgeryDetails,
          prescriptionDetails: dto.prescriptionDetails,
          isDependent: true,
          assignedEmployeeId: primaryContact.assignedEmployeeId,
          contactId: nextContactId,
          tags: (primaryContact.tags && primaryContact.tags.length > 0) ? primaryContact.tags : ['contact'],
        } as any);

        const primaryAddr = await this.prisma.address.findFirst({
          where: { contactId: primaryContact.id, isPrimary: true },
        });
        if (primaryAddr) {
          await this.repo.addAddress(newContact.id, tenantId, {
            type: 'HOME',
            line1: primaryAddr.line1,
            line2: primaryAddr.line2 || undefined,
            city: primaryAddr.city,
            district: primaryAddr.district || undefined,
            state: primaryAddr.state,
            pincode: primaryAddr.pincode,
            country: primaryAddr.country,
            isPrimary: true,
          }).catch(err => this.logger.warn(`Failed copying address to family member contact: ${err.message}`));
        }

        targetRelatedContactId = newContact.id;
      }
    }

    if (targetRelatedContactId === contactId) {
      throw new BadRequestException('A contact cannot be related to itself');
    }

    const relatedContact = await this.prisma.contact.findFirst({
      where: { id: targetRelatedContactId, tenantId },
    });
    if (!relatedContact) {
      throw new NotFoundException(`Related contact ${targetRelatedContactId} not found`);
    }

    const familyDetails: Record<string, unknown> = {};
    for (const field of [
      'firstName',
      'middleName',
      'lastName',
      'maritalStatus',
      'weddingAnniversaryDate',
      'education',
      'height',
      'weight',
      'medicalHistory',
      'declaredMedicalHistory',
      'notDeclaredMedicalHistory',
      'medicalHistoryDetails',
      'surgeryDetails',
      'prescriptionDetails',
    ] as const) {
      if (dto[field] !== undefined) familyDetails[field] = dto[field];
    }
    if (dto.dateOfBirth !== undefined) {
      familyDetails.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    }
    if (dto.phone && dto.phone.trim() && !dto.phone.startsWith('00')) {
      familyDetails.phone = dto.phone.trim();
    }
    if (dto.alternatePhone !== undefined) {
      familyDetails.alternatePhone = dto.alternatePhone || null;
    }
    if (dto.gender && ['MALE', 'FEMALE', 'OTHER'].includes(dto.gender.toUpperCase())) {
      familyDetails.gender = dto.gender.toUpperCase();
    }
    if (Object.keys(familyDetails).length > 0) {
      await this.prisma.contact.update({
        where: { id: relatedContact.id },
        data: familyDetails,
      });
    }
    if (dto.occupation !== undefined) {
      const existingOccupation = await this.prisma.occupation.findFirst({
        where: { contactId: relatedContact.id, isPrimary: true },
      });
      if (dto.occupation.trim() && existingOccupation) {
        await this.prisma.occupation.update({
          where: { id: existingOccupation.id },
          data: { type: dto.occupation.trim() },
        });
      } else if (dto.occupation.trim()) {
        await this.repo.addOccupation(relatedContact.id, tenantId, {
          type: dto.occupation.trim(),
          isPrimary: true,
        });
      } else if (existingOccupation) {
        await this.prisma.occupation.deleteMany({
          where: { contactId: relatedContact.id, isPrimary: true },
        });
      }
    }

    const rel = await this.repo.addBidirectionalRelationship(
      primaryContact,
      relatedContact,
      relType,
    );

    try {
      const memberName = [relatedContact.firstName, relatedContact.middleName, relatedContact.lastName]
        .filter(Boolean)
        .join(' ');
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          userId,
          contactId: primaryContact.id,
          entityType: 'Contact',
          entityId: primaryContact.id,
          action: 'CREATE',
          description: `Family member added: ${memberName} (${relType})`,
        },
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed for addRelationship: ${err.message}`);
    }

    try {
      await this.repo.interconnectFamilyCluster(tenantId, primaryContact.id);
    } catch (e: any) {
      this.logger.warn(`Interconnecting cluster failed: ${e.message}`);
    }

    return { data: rel, message: 'Relationship added successfully' };
  }

  async removeRelationship(tenantId: string, contactId: string, relationshipId: string, userId?: string) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(contactId);
    const primaryContact = await this.prisma.contact.findFirst({
      where: {
        tenantId,
        ...(isObjectId ? { OR: [{ id: contactId }, { contactId }] } : { contactId }),
      },
    });
    if (!primaryContact) {
      throw new NotFoundException(`Contact ${contactId} not found`);
    }

    const existingRelationship = await this.prisma.contactRelationship.findFirst({
      where: { id: relationshipId, primaryContactId: primaryContact.id },
      include: { relatedContact: { select: { firstName: true, lastName: true } } },
    });

    await this.repo.removeRelationship(primaryContact.id, relationshipId, tenantId);

    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          userId,
          contactId: primaryContact.id,
          entityType: 'Contact',
          entityId: primaryContact.id,
          action: 'UPDATE',
          description: `Family relationship removed${existingRelationship?.relatedContact ? ` (${existingRelationship.relatedContact.firstName} ${existingRelationship.relatedContact.lastName || ''})` : ''}`,
        },
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed for removeRelationship: ${err.message}`);
    }

    return { data: null, message: 'Relationship removed' };
  }

  async updateRelationship(
    tenantId: string,
    contactId: string,
    relationshipId: string,
    dto: CreateRelationshipDto,
    userId?: string,
  ) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(contactId);
    const primaryContact = await this.prisma.contact.findFirst({
      where: {
        tenantId,
        ...(isObjectId ? { OR: [{ id: contactId }, { contactId }] } : { contactId }),
      },
    });
    if (!primaryContact) {
      throw new NotFoundException(`Contact ${contactId} not found`);
    }

    const existingRel = await this.prisma.contactRelationship.findFirst({
      where: { id: relationshipId, primaryContactId: primaryContact.id },
    });
    if (!existingRel) {
      throw new NotFoundException(`Relationship record not found`);
    }

    const relatedContactId = existingRel.relatedContactId;

    const previousRelatedContact = await this.prisma.contact.findUnique({
      where: { id: relatedContactId },
    });

    const updateData: any = {};
    if (dto.name && dto.name.trim()) {
      const nameParts = dto.name.trim().split(' ').filter(Boolean);
      if (nameParts[0]) updateData.firstName = nameParts[0];
      updateData.lastName = nameParts.slice(1).join(' ') || '';
    }
    if (dto.phone && dto.phone.trim() && !dto.phone.startsWith('00')) {
      updateData.phone = dto.phone.trim();
    }
    if (dto.dateOfBirth) {
      updateData.dateOfBirth = new Date(dto.dateOfBirth);
    }
    if (dto.gender && ['MALE', 'FEMALE', 'OTHER'].includes(dto.gender.toUpperCase())) {
      updateData.gender = dto.gender.toUpperCase();
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.contact.update({
        where: { id: relatedContactId },
        data: updateData,
      });
    }

    const updatedRelatedContact = await this.prisma.contact.findUnique({
      where: { id: relatedContactId },
    });

    let relType = (dto.relationshipType || existingRel.relationshipType).toUpperCase() as any;
    const validEnums = ['SELF', 'SPOUSE', 'CHILD', 'SON', 'DAUGHTER', 'PARENT', 'FATHER', 'MOTHER', 'SIBLING', 'BROTHER', 'SISTER', 'IN_LAW', 'OTHER'];
    if (!validEnums.includes(relType)) {
      relType = 'OTHER';
    }

    const rel = await this.repo.addBidirectionalRelationship(
      primaryContact,
      updatedRelatedContact,
      relType,
    );

    try {
      await this.repo.interconnectFamilyCluster(tenantId, primaryContact.id);
    } catch (e: any) {
      this.logger.warn(`Interconnecting cluster failed: ${e.message}`);
    }

    const changedFields = [
      ...(previousRelatedContact?.firstName !== updatedRelatedContact?.firstName || previousRelatedContact?.lastName !== updatedRelatedContact?.lastName ? ['name'] : []),
      ...(previousRelatedContact?.phone !== updatedRelatedContact?.phone ? ['phone'] : []),
      ...(String(previousRelatedContact?.dateOfBirth || '') !== String(updatedRelatedContact?.dateOfBirth || '') ? ['date of birth'] : []),
      ...(previousRelatedContact?.gender !== updatedRelatedContact?.gender ? ['gender'] : []),
      ...(existingRel.relationshipType !== relType ? ['relationship'] : []),
    ];

    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          userId,
          contactId: primaryContact.id,
          entityType: 'Contact',
          entityId: primaryContact.id,
          action: 'UPDATE',
          description: `Family relationship updated (${relType})${changedFields.length > 0 ? `: modified ${changedFields.join(', ')}` : ''}`,
        },
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed for updateRelationship: ${err.message}`);
    }

    return { data: rel, message: 'Relationship and contact profile updated successfully' };
  }

  async syncFamilyCluster(contactId: string, tenantId: string) {
    const contact = await this.repo.findOne(tenantId, contactId);
    if (!contact) {
      throw new NotFoundException(`Contact ${contactId} not found`);
    }
    await this.repo.interconnectFamilyCluster(tenantId, contact.id);
    const resolved = await this.repo.resolveFullFamilyRelationships(tenantId, contact);
    return { data: resolved, message: 'Family cluster synchronized successfully' };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(tenantId: string) {
    const stats = await this.repo.getStats(tenantId);
    return { data: stats };
  }

  async upcomingBirthdays(tenantId: string, days: number) {
    const contacts = await this.repo.upcomingBirthdays(tenantId, days);
    return { data: contacts };
  }

  // ── Bulk operations ───────────────────────────────────────────────────────

  async bulkTag(tenantId: string, dto: BulkTagDto) {
    const count = dto.remove
      ? await this.repo.bulkRemoveTags(tenantId, dto.contactIds, dto.tags)
      : await this.repo.bulkAddTags(tenantId, dto.contactIds, dto.tags);
    return {
      data:    { affected: count },
      message: `Tags ${dto.remove ? 'removed from' : 'added to'} ${count} contact(s)`,
    };
  }

  async bulkDelete(tenantId: string, dto: BulkDeleteDto) {
    const count = await this.repo.bulkDelete(tenantId, dto.contactIds);
    return { data: { affected: count }, message: `${count} contact(s) deactivated` };
  }

  // ── CSV export ────────────────────────────────────────────────────────────

  async exportCsv(tenantId: string): Promise<string> {
    const contacts = await this.repo.findAllForExport(tenantId);

    const headers = [
      'First Name', 'Last Name', 'Phone', 'Alternate Phone', 'Email',
      'Date of Birth', 'Gender', 'PAN Number', 'Aadhaar Number',
      'Annual Income', 'Tags', 'Notes',
      'Primary City', 'Primary State', 'Primary Pincode',
      'Occupation Type', 'Company Name', 'Designation',
    ];

    const escape = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    const rows = contacts.map(c => {
      const addr = (c as any).addresses?.[0];
      const occ  = (c as any).occupations?.[0];
      return [
        c.firstName, c.lastName, c.phone, c.alternatePhone ?? '', c.email ?? '',
        c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().split('T')[0] : '',
        c.gender ?? '', c.panNumber ?? '', c.aadhaarNumber ?? '',
        c.annualIncome ?? '', (c.tags ?? []).join('|'), c.notes ?? '',
        addr?.city ?? '', addr?.state ?? '', addr?.pincode ?? '',
        occ?.type ?? '', occ?.companyName ?? '', occ?.designation ?? '',
      ].map(escape).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  // ── CSV import ────────────────────────────────────────────────────────────

  async importContacts(
    tenantId: string,
    createdById: string,
    rows: Array<{
      firstName: string; lastName: string; phone: string;
      email?: string; gender?: string; dateOfBirth?: string;
      panNumber?: string; annualIncome?: string; tags?: string; notes?: string;
    }>,
    role?: UserRole,
  ) {
    let created = 0;
    const skipped: string[] = [];

    for (const row of rows) {
      if (!row.firstName || !row.phone) { skipped.push(row.phone ?? 'unknown'); continue; }

      const exists = await this.repo.findByPhone(tenantId, row.phone);
      if (exists) { skipped.push(row.phone); continue; }

      const contact = await this.repo.create(tenantId, {
        firstName:    row.firstName,
        lastName:     row.lastName || '',
        phone:        row.phone,
        email:        row.email,
        gender:       row.gender as any,
        dateOfBirth:  row.dateOfBirth,
        panNumber:    row.panNumber,
        annualIncome: row.annualIncome ? parseFloat(row.annualIncome) : undefined,
        tags:         row.tags ? row.tags.split('|').map(t => t.trim()).filter(Boolean) : [],
        notes:        row.notes,
      });


      try {
        await this.prisma.activityLog.create({
          data: {
            tenantId,
            userId:      createdById,
            contactId:   contact.id,
            entityType:  'Contact',
            entityId:    contact.id,
            action:      'CREATE',
            description: `Contact imported: ${row.firstName} ${row.lastName}`,
          },
        });
      } catch (err: any) {
        this.logger.warn(`ActivityLog write failed for import: ${err.message}`);
      }

      created++;
    }

    return {
      data:    { created, skipped },
      message: `Imported ${created} contact(s), skipped ${skipped.length}`,
    };
  }

  // ── Invite contact to client portal ─────────────────────────────────────

  async inviteToPortal(tenantId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      include: { tenant: { select: { name: true } } },
    });

    if (!contact) throw new NotFoundException('Contact not found');
    if (contact.userId) throw new ConflictException('Contact already has portal access');
    if (!contact.email) throw new BadRequestException('Contact must have an email address to receive portal access');

    const emailTaken = await this.prisma.user.findFirst({
      where: { tenantId, email: contact.email },
    });
    if (emailTaken) throw new ConflictException('A user with this email already exists');

    const tempPassword = Math.random().toString(36).slice(-8) + 'Aa1!';
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { tenantId, email: contact.email!, passwordHash, role: UserRole.CONTACT },
      });
      await tx.contact.update({ where: { id: contactId }, data: { userId: newUser.id } });
    });

    const name = `${contact.firstName} ${contact.lastName}`;
    this.email.sendContactInviteEmail(contact.email, name, tempPassword, contact.tenant.name)
      .catch(e => this.logger.error(`Failed to send portal invite: ${e.message}`));

    return { message: 'Portal invitation sent successfully' };
  }

  // ── Activity log for a contact ────────────────────────────────────────────

  async getActivityLog(tenantId: string, contactId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where:   { tenantId, contactId },
        orderBy: { createdAt: 'desc' },
        skip,
        take:    limit,
      }),
      this.prisma.activityLog.count({ where: { tenantId, contactId } }),
    ]);
    return { data, meta: { total, page, limit } };
  }

  private async checkContactAccess(tenantId: string, contactId: string, userId: string, role: UserRole) {
    if (role !== UserRole.EMPLOYEE) return;

    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        tenantId,
        OR: [
          { assignedEmployeeId: null },
          { assignedEmployeeId: userId },
        ],
      }
    });
    if (contact) return;

    const [policyCount, leadCount, claimCount] = await Promise.all([
      this.prisma.policy.count({
        where: { contactId, tenantId, assignedEmployeeId: userId }
      }),
      this.prisma.productInterest.count({
        where: { contactId, tenantId, assignedEmployeeId: userId }
      }),
      this.prisma.claim.count({
        where: { contactId, tenantId, assignedEmployeeId: userId }
      })
    ]);

    if (policyCount === 0 && leadCount === 0 && claimCount === 0) {
      throw new ForbiddenException('Access denied to this contact profile');
    }
  }

  async pickContact(tenantId: string, contactId: string, userId: string, role?: UserRole) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    if (role === UserRole.EMPLOYEE && contact.assignedEmployeeId && contact.assignedEmployeeId !== userId) {
      throw new ConflictException('This contact has already been assigned to another employee.');
    }

    const updated = await this.prisma.contact.updateMany({
      where: {
        id: contactId,
        tenantId,
        OR: [
          { assignedEmployeeId: null },
          { assignedEmployeeId: userId },
          ...(role !== UserRole.EMPLOYEE ? [{}] : []),
        ],
      },
      data: {
        assignedEmployeeId: userId,
      },
    });

    if (updated.count === 0) {
      throw new ConflictException('This contact has already been assigned to another employee.');
    }

    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          userId,
          contactId,
          entityType: 'Contact',
          entityId: contactId,
          action: 'UPDATE',
          description: `Contact picked/assigned to employee ${userId}`,
        },
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed: ${err.message}`);
    }

    const fresh = await this.repo.findOne(tenantId, contactId);

    if (fresh) {
      const contactName = `${fresh.firstName} ${fresh.lastName}`.trim();
      await this.notifEngine.notifyAssignment({
        tenantId,
        assignerId: userId,
        assigneeId: userId, // Note: pickContact assigns to self if picked, but if assigned by someone else, notify
        recordType: 'Contact',
        recordId: contactId,
        recordName: contactName || 'Contact',
      }).catch(err => this.logger.warn(`Failed sending contact assignment notification: ${err.message}`));
    }

    return { data: fresh, message: 'Contact assigned successfully' };
  }

  async createContactFull(
    tenantId: string,
    dto: {
      contact: CreateContactDto;
      address?: CreateAddressDto;
      occupation?: CreateOccupationDto;
    },
    createdById: string,
    role?: UserRole,
  ) {
    if (!dto.contact.phone || !dto.contact.phone.trim()) {
      if (dto.contact.isDependent) {
        dto.contact.phone = `00${Date.now().toString().slice(-8)}`;
      } else {
        dto.contact.phone = '0000000000';
      }
    }

    if (dto.contact.phone !== '0000000000' && !dto.contact.phone.startsWith('00')) {
      const existing = await this.repo.findByPhone(tenantId, dto.contact.phone);
      if (existing) {
        throw new ConflictException(`A contact with phone ${dto.contact.phone} already exists`);
      }
    }

    if (role === UserRole.EMPLOYEE) {
      dto.contact.assignedEmployeeId = createdById;
    }

    const nextContactId = await this.getNextContactId();
    const result = await this.prisma.$transaction(async (tx) => {
      const { dateOfBirth, city, followUpDate, ...rest } = dto.contact as any;
      const dob = parseSafeDate(dateOfBirth);
      const fuDate = parseSafeDate(followUpDate);
      const contact = await tx.contact.create({
        data: {
          ...rest,
          tenantId,
          contactId: rest.contactId || nextContactId,
          ...(dob ? { dateOfBirth: dob } : {}),
          ...(fuDate ? { followUpDate: fuDate } : {}),
        },
      });

      let address: any = null;
      if (dto.address) {
        address = await tx.address.create({
          data: {
            ...dto.address,
            contactId: contact.id,
          },
        });
      } else if (city) {
        address = await tx.address.create({
          data: {
            type: 'HOME',
            line1: 'N/A',
            city,
            state: 'N/A',
            pincode: 'N/A',
            country: 'India',
            isPrimary: true,
            contactId: contact.id,
          },
        });
      }

      let occupation: any = null;
      if (dto.occupation) {
        occupation = await tx.occupation.create({
          data: {
            ...dto.occupation,
            contactId: contact.id,
          },
        });
      }

      return { contact, address, occupation };
    });

    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          userId:     createdById,
          contactId:  result.contact.id,
          entityType: 'Contact',
          entityId:   result.contact.id,
          action:     'CREATE',
          description: `Contact ${result.contact.firstName} ${result.contact.lastName} created with full profile`,
        },
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed: ${err.message}`);
    }

    return { data: result, message: 'Contact profile created successfully' };
  }

  async updateContactRole(tenantId: string, contactId: string, role: string, permissions?: string[]) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    if (!contact.userId) throw new BadRequestException('Contact does not have a linked user account');

    const updatedUser = await this.prisma.user.update({
      where: { id: contact.userId },
      data: {
        role: role as any,
        permissions: permissions ?? [],
      },
    });

    return { data: updatedUser, message: 'Contact role updated successfully' };
  }

  async logInteraction(
    tenantId: string,
    contactId: string,
    userId: string,
    dto: {
      interactionType?: string; // Call, WhatsApp, Meeting
      leadStage?: string;
      leadStatus?: string;
      leadType?: string;
      nextFollowUp?: string;    // Date string
      notes?: string;           // Consultation Comment
    },
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    const type = dto.interactionType || 'Call';
    const stage = dto.leadStage;
    const status = dto.leadStatus;
    const leadType = dto.leadType;
    const nextFollowUp = dto.nextFollowUp ? new Date(dto.nextFollowUp) : null;
    const notes = dto.notes || '';

    // Create the interaction log (ActivityLog)
    const logAction = type.toUpperCase();
    const logDescription = `Logged ${type} interaction. Stage: ${stage ?? '—'}, Status: ${status ?? '—'}, Type: ${leadType ?? '—'}.${notes ? ` Comment: ${notes}` : ''}${nextFollowUp ? ` Follow-up scheduled: ${nextFollowUp.toLocaleDateString()}` : ''}`;

    await this.prisma.activityLog.create({
      data: {
        tenantId,
        userId,
        contactId,
        entityType: 'Contact',
        entityId: contactId,
        action: logAction,
        description: logDescription,
      },
    });

    // Update Contact fields
    await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        leadStage: stage || undefined,
        leadStatus: status || undefined,
        leadType: leadType || undefined,
        followUpDate: nextFollowUp,
      },
    });

    return { message: 'Interaction logged successfully' };
  }

  async bulkImportContactsJson(
    tenantId: string,
    createdById: string,
    contacts: BulkImportContact[],
    role?: UserRole
  ) {
    let created = 0;
    const skipped: string[] = [];
    const warnings: string[] = [];

    for (let rowIndex = 0; rowIndex < contacts.length; rowIndex++) {
      const row = contacts[rowIndex];
      const rowNumber = row.rowNumber || rowIndex + 1;
      const c = row.contact || row as unknown as CreateContactDto;
      if (row.importErrors?.length) {
        skipped.push(`Row ${rowNumber}: ${row.importErrors.join(', ')}`);
        continue;
      }
      const normalizedPhone = (c.phone || '').replace(/\D/g, '').slice(-10);
      if (!c.firstName?.trim() || !normalizedPhone || normalizedPhone.length !== 10) {
        skipped.push(`Row ${rowNumber}: first name and a 10-digit phone are required`);
        continue;
      }

      const exists = await this.repo.findByPhone(tenantId, normalizedPhone);
      if (exists) { skipped.push(`Row ${rowNumber}: phone ${normalizedPhone} already exists`); continue; }

      const contactDetails = {
        ...c,
        phone: normalizedPhone,
        annualIncome: c.annualIncome === undefined ? undefined : Number(c.annualIncome),
        tags: Array.isArray(c.tags) ? c.tags : [],
      };
      let createdProfile: Awaited<ReturnType<ContactsService['createContactFull']>>;
      try {
        createdProfile = await this.createContactFull(
          tenantId,
          {
            contact: contactDetails,
            address: row.address,
            occupation: row.occupation,
          },
          createdById,
          role,
        );
      } catch (err: any) {
        skipped.push(`Row ${rowNumber}: ${err.message}`);
        continue;
      }
      const contact = createdProfile.data.contact;
      const policyIdsByNumber = new Map<string, string>();

      for (const [index, interest] of (row.productInterests || []).entries()) {
        if (interest.importErrors?.length) {
          warnings.push(`Row ${rowNumber}, product interest ${index + 1}: ${interest.importErrors.join(', ')}`);
          continue;
        }
        if (!interest.interests?.length) {
          warnings.push(`Row ${rowNumber}, product interest ${index + 1}: Categories are required`);
          continue;
        }
        try {
          const followUpDate = parseSafeDate(interest.followUpDate);
          const premiumBudget = Number(interest.premiumBudget);
          if (!interest.source?.trim() || !followUpDate || !Number.isFinite(premiumBudget) || premiumBudget <= 0) {
            throw new BadRequestException('Lead Source, Follow-up Date, and Expected Premium / Budget greater than zero are required');
          }
          const normalizedStage = interest.stage?.trim().toUpperCase();
          const stage = Object.values(LeadStage).includes(normalizedStage as LeadStage)
            ? normalizedStage as LeadStage
            : LeadStage.TO_CONTACT;
          const notes = JSON.stringify({
            leadStatus: interest.leadStatus || 'INTERESTED',
            leadType: interest.leadType || 'FRESH',
            dependencyType: interest.dependencyType || 'SELF',
            dependentDetails: interest.dependentDetails || '',
            descriptionDetails: interest.descriptionDetails || '',
            cleanNotes: interest.notes || '',
          });
          await this.prisma.productInterest.create({
            data: {
              tenantId,
              contactId: contact.id,
              interests: interest.interests,
              source: interest.source || undefined,
              stage,
              ...(followUpDate ? { followUpDate } : {}),
              premiumBudget,
              ...(interest.sumAssuredRequired !== undefined ? { sumAssuredRequired: interest.sumAssuredRequired } : {}),
              notes,
              assignedEmployeeId: contact.assignedEmployeeId || undefined,
            },
          });
        } catch (err: any) {
          warnings.push(`Row ${rowNumber}, product interest ${index + 1}: ${err.message}`);
        }
      }

      for (const [index, member] of (row.familyMembers || []).entries()) {
        if (!member.firstName?.trim()) {
          warnings.push(`Row ${rowNumber}, family member ${index + 1}: First Name is required`);
          continue;
        }
        if (!member.relationshipType?.trim()) {
          warnings.push(`Row ${rowNumber}, family member ${index + 1}: Relationship is required`);
          continue;
        }
        try {
          await this.addRelationship(tenantId, contact.id, member, createdById);
        } catch (err: any) {
          warnings.push(`Row ${rowNumber}, family member ${index + 1}: ${err.message}`);
        }
      }

      for (const [index, policy] of (row.policies || []).entries()) {
        if (policy.importErrors?.length) {
          warnings.push(`Row ${rowNumber}, policy ${index + 1}: ${policy.importErrors.join(', ')}`);
          continue;
        }
        if (!policy.policyNumber?.trim()) {
          warnings.push(`Row ${rowNumber}, policy ${index + 1}: Policy Number is required`);
          continue;
        }
        try {
          const startDate = parseSafeDate(policy.startDate);
          const endDate = parseSafeDate(policy.endDate);
          const sumAssured = Number(policy.sumAssured);
          const premiumAmount = Number(policy.premiumAmount);
          if (!policy.planName?.trim() || !startDate || !endDate ||
              !Number.isFinite(sumAssured) || !Number.isFinite(premiumAmount)) {
            throw new BadRequestException('Policy Number, Plan Name, Sum Assured, Premium, Start Date, and End Date are required');
          }

          const plan = await this.prisma.insurancePlan.findFirst({
            where: {
              tenantId,
              OR: [
                { name: { equals: policy.planName.trim(), mode: 'insensitive' } },
                { planCode: { equals: policy.planName.trim(), mode: 'insensitive' } },
              ],
            },
            select: { id: true },
          });
          if (!plan) throw new NotFoundException(`Insurance plan "${policy.planName}" was not found`);

          const duplicate = await this.prisma.policy.findFirst({
            where: { tenantId, policyNumber: policy.policyNumber.trim() },
            select: { id: true },
          });
          if (duplicate) throw new ConflictException(`Policy number ${policy.policyNumber} already exists`);

          const normalizedStatus = policy.status?.trim().toUpperCase();
          const status = Object.values(PolicyStatus).includes(normalizedStatus as PolicyStatus)
            ? normalizedStatus as PolicyStatus
            : PolicyStatus.ACTIVE;
          const normalizedFrequency = policy.paymentFrequency?.trim().toUpperCase();
          const paymentFrequency = Object.values(PaymentFrequency).includes(normalizedFrequency as PaymentFrequency)
            ? normalizedFrequency as PaymentFrequency
            : PaymentFrequency.YEARLY;
          const maturityDate = parseSafeDate(policy.maturityDate);
          const nextDueDate = parseSafeDate(policy.nextDueDate);
          const savedPolicy = await this.prisma.policy.create({
            data: {
              tenantId,
              contactId: contact.id,
              planId: plan.id,
              policyNumber: policy.policyNumber.trim(),
              status,
              sumAssured,
              premiumAmount,
              paymentFrequency,
              startDate,
              endDate,
              assignedEmployeeId: contact.assignedEmployeeId || undefined,
              ...(maturityDate ? { maturityDate } : {}),
              ...(nextDueDate ? { nextDueDate } : {}),
              ...(policy.agentCode?.trim() ? { agentCode: policy.agentCode.trim() } : {}),
              ...(policy.notes?.trim() ? { notes: policy.notes.trim() } : {}),
            },
          });
          policyIdsByNumber.set(policy.policyNumber.trim().toLowerCase(), savedPolicy.id);
          try {
            await this.prisma.activityLog.create({
              data: {
                tenantId,
                userId: createdById,
                contactId: contact.id,
                entityType: 'Policy',
                entityId: savedPolicy.id,
                action: 'CREATE',
                description: `Policy ${savedPolicy.policyNumber} imported`,
              },
            });
          } catch (err: any) {
            this.logger.warn(`ActivityLog write failed for imported policy: ${err.message}`);
          }
        } catch (err: any) {
          warnings.push(`Row ${rowNumber}, policy ${index + 1}: ${err.message}`);
        }
      }

      for (const [index, claim] of (row.claims || []).entries()) {
        if (claim.importErrors?.length) {
          warnings.push(`Row ${rowNumber}, claim ${index + 1}: ${claim.importErrors.join(', ')}`);
          continue;
        }
        if (!claim.claimNumber?.trim()) {
          warnings.push(`Row ${rowNumber}, claim ${index + 1}: Claim Number is required`);
          continue;
        }
        try {
          const policyId = policyIdsByNumber.get((claim.policyNumber || '').trim().toLowerCase());
          const policy = policyId
            ? await this.prisma.policy.findFirst({ where: { id: policyId, tenantId, contactId: contact.id } })
            : await this.prisma.policy.findFirst({
                where: { tenantId, contactId: contact.id, policyNumber: (claim.policyNumber || '').trim() },
              });
          const intimatedAt = parseSafeDate(claim.intimatedAt);
          const claimAmount = Number(claim.claimAmount);
          if (!policy || !intimatedAt || !claim.claimType?.trim() || !Number.isFinite(claimAmount)) {
            throw new BadRequestException('Claim Number, this contact’s Policy Number, Claim Type, Claim Amount, and Intimated At are required');
          }
          if (intimatedAt.getTime() > Date.now()) {
            throw new BadRequestException('Intimated At cannot be in the future');
          }
          const duplicateClaim = await this.prisma.claim.findFirst({
            where: { tenantId, claimNumber: claim.claimNumber.trim() },
            select: { id: true },
          });
          if (duplicateClaim) throw new ConflictException(`Claim number ${claim.claimNumber} already exists`);
          const normalizedStatus = claim.status?.trim().toUpperCase();
          const status = Object.values(ClaimStatus).includes(normalizedStatus as ClaimStatus)
            ? normalizedStatus as ClaimStatus
            : ClaimStatus.INTIMATED;
          const approvedAmount = claim.approvedAmount === undefined ? undefined : Number(claim.approvedAmount);
          const savedClaim = await this.prisma.claim.create({
            data: {
              tenantId,
              contactId: contact.id,
              policyId: policy.id,
              claimNumber: claim.claimNumber.trim(),
              claimType: claim.claimType.trim().toUpperCase(),
              claimAmount,
              status,
              intimatedAt,
              assignedEmployeeId: contact.assignedEmployeeId || undefined,
              ...(Number.isFinite(approvedAmount) ? { approvedAmount } : {}),
              ...(parseSafeDate(claim.filedAt) ? { filedAt: parseSafeDate(claim.filedAt) } : {}),
              ...(parseSafeDate(claim.settledAt) ? { settledAt: parseSafeDate(claim.settledAt) } : {}),
              ...(claim.notes?.trim() ? { notes: claim.notes.trim() } : {}),
              ...(claim.rejectionReason?.trim() ? { rejectionReason: claim.rejectionReason.trim() } : {}),
            },
          });
          try {
            await this.prisma.activityLog.create({
              data: {
                tenantId,
                userId: createdById,
                contactId: contact.id,
                entityType: 'Claim',
                entityId: savedClaim.id,
                action: 'CREATE',
                description: `Claim ${savedClaim.claimNumber} imported`,
              },
            });
          } catch (err: any) {
            this.logger.warn(`ActivityLog write failed for imported claim: ${err.message}`);
          }
        } catch (err: any) {
          warnings.push(`Row ${rowNumber}, claim ${index + 1}: ${err.message}`);
        }
      }

      created++;
    }

    return {
      data: { created, skipped, warnings },
      message: `Imported ${created} contact(s), skipped ${skipped.length} contact row(s), ${warnings.length} related record(s) could not be imported`,
    };
  }
}
