// ─────────────────────────────────────────────────────────────────────────────
// Contacts Service — business logic layer
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { ContactsRepository } from './contacts.repository';
import { PrismaService }      from '../../database/prisma.service';
import { EmailService }       from '../../common/email/email.service';
import * as bcrypt from 'bcryptjs';
import { UserRole }           from '@prisma/client';
import {
  CreateContactDto, UpdateContactDto,
  CreateAddressDto, CreateOccupationDto,
  CreateRelationshipDto, ContactFilterDto,
  BulkTagDto, BulkDeleteDto,
} from './dto/contact.dto';

import { NotificationEngineService } from '../notifications/notification-engine.service';

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

    await this.repo.update(tenantId, id, dto);

    // Create/update primary Address if city is provided
    if (dto.city) {
      await this.repo.addAddress(id, tenantId, {
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
          contactId:  id,
          entityType: 'Contact',
          entityId:   id,
          action:     'UPDATE',
          description: 'Contact profile updated',
        },
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed for contact ${id}: ${err.message}`);
    }

    const updated = await this.repo.findOne(tenantId, id);

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

  async remove(tenantId: string, id: string) {
    const existing = await this.repo.findOne(tenantId, id);
    if (!existing) throw new NotFoundException(`Contact ${id} not found`);
    await this.repo.remove(tenantId, id);
    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
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

  async addAddress(tenantId: string, contactId: string, dto: CreateAddressDto) {
    const address = await this.repo.addAddress(contactId, tenantId, dto);
    return { data: address, message: 'Address added' };
  }

  async removeAddress(tenantId: string, contactId: string, addressId: string) {
    await this.repo.removeAddress(contactId, addressId, tenantId);
    return { data: null, message: 'Address removed' };
  }

  // ── Occupations ──────────────────────────────────────────────────────────

  async addOccupation(tenantId: string, contactId: string, dto: CreateOccupationDto) {
    const occ = await this.repo.addOccupation(contactId, tenantId, dto);
    return { data: occ, message: 'Occupation added' };
  }

  async removeOccupation(tenantId: string, contactId: string, occupationId: string) {
    await this.repo.removeOccupation(contactId, occupationId, tenantId);
    return { data: null, message: 'Occupation removed' };
  }

  // ── Relationships ─────────────────────────────────────────────────────────

  async addRelationship(tenantId: string, contactId: string, dto: CreateRelationshipDto) {
    if (dto.relatedContactId === contactId) {
      throw new BadRequestException('A contact cannot be related to itself');
    }
    const rel = await this.repo.addRelationship(contactId, tenantId, dto);
    return { data: rel, message: 'Relationship added' };
  }

  async removeRelationship(tenantId: string, contactId: string, relationshipId: string) {
    await this.repo.removeRelationship(contactId, relationshipId, tenantId);
    return { data: null, message: 'Relationship removed' };
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

    const result = await this.prisma.$transaction(async (tx) => {
      const { dateOfBirth, city, ...rest } = dto.contact as any;
      const contact = await tx.contact.create({
        data: {
          ...rest,
          tenantId,
          ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
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
    contacts: CreateContactDto[],
    role?: UserRole
  ) {
    let created = 0;
    const skipped: string[] = [];

    for (const c of contacts) {
      if (!c.firstName || !c.phone) { skipped.push('unknown'); continue; }

      const exists = await this.repo.findByPhone(tenantId, c.phone);
      if (exists) { skipped.push(c.phone); continue; }

      const contact = await this.repo.create(tenantId, c);


      try {
        await this.prisma.activityLog.create({
          data: {
            tenantId,
            userId:      createdById,
            contactId:   contact.id,
            entityType:  'Contact',
            entityId:    contact.id,
            action:      'CREATE',
            description: `Contact bulk imported from directory: ${contact.firstName} ${contact.lastName}`,
          },
        });
      } catch (err: any) {
        this.logger.warn(`ActivityLog write failed for bulk import: ${err.message}`);
      }

      created++;
    }

    return {
      data: { created, skipped },
      message: `Bulk imported ${created} contact(s) from directory, skipped ${skipped.length}`
    };
  }
}

