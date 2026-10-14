// ─────────────────────────────────────────────────────────────────────────────
// Claims Service — manages the full claim lifecycle
// INTIMATED → FILED → IN_REVIEW → APPROVED/REJECTED → SETTLED
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, NotFoundException, ConflictException, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import {
  CreateClaimDto, UpdateClaimDto, UpdateClaimStatusDto,
  AddExpenseDto, ClaimQueryDto,
} from './dto/claim.dto';
import { ClaimStatus, UserRole } from '@prisma/client';

function parseClaimStatus(raw?: string | null): ClaimStatus | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  if (s in ClaimStatus) return s as ClaimStatus;
  const lower = raw.trim().toLowerCase();
  if (lower === 'approved' || lower.includes('approved')) return ClaimStatus.APPROVED;
  if (lower === 'rejected' || lower.includes('rejected') || lower.includes('cancelled')) return ClaimStatus.REJECTED;
  if (lower === 'settled' || lower.includes('settled')) return ClaimStatus.SETTLED;
  if (
    lower === 'in progress' ||
    lower.includes('progress') ||
    lower.includes('query') ||
    lower.includes('discharge') ||
    lower.includes('submitted') ||
    lower.includes('collected') ||
    lower.includes('review') ||
    lower.includes('approval')
  ) {
    return ClaimStatus.IN_REVIEW;
  }
  if (lower === 'pending' || lower === 'intimated' || lower.includes('pending documents')) {
    return ClaimStatus.INTIMATED;
  }
  return null;
}

function rejectFutureIntimationDate(value?: string) {
  if (!value) return;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const intimationDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (intimationDate > today) {
    throw new BadRequestException('Intimation Date cannot be in the future');
  }
}

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifEngine: NotificationEngineService,
  ) {}

  async findAll(tenantId: string, userId: string, role: UserRole, query: ClaimQueryDto) {
    const page  = Math.max(1, parseInt(String((query as any).page  ?? 1), 10) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(String((query as any).limit ?? 20), 10) || 20));
    const { status, search, claimType, assignedEmployeeId, contactId, sortBy, sortOrder } = query as any;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (contactId) {
      if (/^[0-9a-fA-F]{24}$/.test(contactId)) {
        where.contactId = contactId;
      } else {
        const targetContact = await this.prisma.contact.findFirst({
          where: { tenantId, contactId },
          select: { id: true },
        });
        if (targetContact) {
          where.contactId = targetContact.id;
        } else {
          where.contactId = contactId;
        }
      }
    }
    if (role === UserRole.EMPLOYEE) {
      const empProfile = await this.prisma.employeeProfile.findFirst({
        where: { userId, tenantId },
        select: { id: true },
      });
      const validIds = [userId];
      if (empProfile?.id) validIds.push(empProfile.id);

      where.OR = [
        { assignedEmployeeId: null },
        { assignedEmployeeId: { in: validIds } },
      ];
    } else if (assignedEmployeeId) {
      where.assignedEmployeeId = assignedEmployeeId === 'UNASSIGNED' ? null : assignedEmployeeId;
    }
    if (status)    where.status    = status;
    if (claimType) where.claimType = claimType;
    if (search) {
      const cleanSearch = search.trim();
      const tokens = cleanSearch.split(/\s+/).filter(Boolean);
      const searchOr: any[] = [
        { claimNumber: { contains: cleanSearch, mode: 'insensitive' } },
        { contact: { firstName: { contains: cleanSearch, mode: 'insensitive' } } },
        { contact: { lastName:  { contains: cleanSearch, mode: 'insensitive' } } },
        { contact: { phone: { contains: cleanSearch } } },
        { policy: { policyNumber: { contains: cleanSearch, mode: 'insensitive' } } },
      ];
      if (tokens.length >= 2) {
        searchOr.push(
          {
            contact: {
              is: {
                AND: tokens.map((token: string) => ({
                  OR: [
                    { firstName: { contains: token, mode: 'insensitive' } },
                    { lastName: { contains: token, mode: 'insensitive' } },
                  ],
                })),
              },
            },
          },
          {
            contact: {
              firstName: { contains: tokens[0], mode: 'insensitive' },
              lastName: { contains: tokens.slice(1).join(' '), mode: 'insensitive' },
            },
          },
          {
            contact: {
              firstName: { contains: tokens.slice(0, -1).join(' '), mode: 'insensitive' },
              lastName: { contains: tokens[tokens.length - 1], mode: 'insensitive' },
            },
          },
          {
            contact: {
              firstName: { contains: tokens.slice(1).join(' '), mode: 'insensitive' },
              lastName: { contains: tokens[0], mode: 'insensitive' },
            },
          }
        );
      }
      if (where.OR) {
        where.AND = [...(where.AND ?? []), { OR: where.OR }, { OR: searchOr }];
        delete where.OR;
      } else {
        where.OR = searchOr;
      }
    }

    const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';
    let orderBy: any = { createdAt: orderDir };

    if (sortBy) {
      if (sortBy === 'policy.policyNumber') {
        orderBy = { policy: { policyNumber: orderDir } };
      } else if (sortBy === 'contact.firstName') {
        orderBy = { contact: { firstName: orderDir } };
      } else {
        orderBy = { [sortBy]: orderDir };
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.claim.findMany({
        where,
        skip,
        take:    limit,
        include: {
          contact: { select: { firstName: true, lastName: true, phone: true } },
          policy:  {
            include: {
              plan: {
                include: {
                  company: { select: { name: true } }
                }
              }
            }
          },
        },
        orderBy,
      }),
      this.prisma.claim.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(tenantId: string, id: string, userId?: string, role?: UserRole) {
    const claim = await this.prisma.claim.findFirst({
      where:   { id, tenantId },
      include: {
        contact:  true,
        policy:   { include: { plan: { include: { company: true } }, members: true, nominees: true } },
        expenses: { orderBy: { date: 'desc' } },
        documents: true,
      },
    });
    if (!claim) throw new NotFoundException('Claim not found');
    if (role === UserRole.EMPLOYEE && claim.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return { data: claim };
  }

  async create(tenantId: string, dto: CreateClaimDto, createdById: string, role?: UserRole) {
    rejectFutureIntimationDate(dto.intimatedAt);

    // Ensure claim number is unique
    const exists = await this.prisma.claim.findFirst({
      where: { tenantId, claimNumber: dto.claimNumber },
    });
    if (exists) throw new ConflictException('Claim number already exists');

    const { intimatedAt, ...restDto } = dto as any;

    // Auto-assign to the creating employee when no assignee is provided
    if (role === UserRole.EMPLOYEE && !restDto.assignedEmployeeId) {
      restDto.assignedEmployeeId = createdById;
    }

    let initialStatus: ClaimStatus = dto.status || ClaimStatus.INTIMATED;
    if (!dto.status && dto.notes) {
      try {
        const parsed = JSON.parse(dto.notes);
        if (parsed.uiClaimStatus) {
          const derived = parseClaimStatus(parsed.uiClaimStatus);
          if (derived) initialStatus = derived;
        }
      } catch {}
    }

    const claim = await this.prisma.claim.create({
      data: { ...restDto, tenantId, status: initialStatus, intimatedAt: new Date(intimatedAt) } as any,
    });

    await this.logActivity(tenantId, createdById, dto.contactId, claim.id, 'CREATE',
      `Claim ${dto.claimNumber} intimated for ${dto.claimType}`);

    // Notify assigned employee
    if (dto.assignedEmployeeId) {
      await this.notifEngine.notifyClaimAssigned(
        tenantId, claim.id, dto.claimNumber, dto.assignedEmployeeId,
      );
      await this.notifEngine.notifyAssignment({
        tenantId,
        assignerId: createdById,
        assigneeId: dto.assignedEmployeeId,
        recordType: 'Claim',
        recordId: claim.id,
        recordName: dto.claimNumber || 'Claim',
      }).catch(err => this.logger.warn(`Failed sending claim assignment notification: ${err.message}`));
    }

    return { data: claim, message: 'Claim created successfully' };
  }

  async update(tenantId: string, id: string, dto: UpdateClaimDto, userId: string, role?: UserRole) {
    rejectFutureIntimationDate(dto.intimatedAt);

    const claim = await this.prisma.claim.findFirst({ where: { id, tenantId } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (role === UserRole.EMPLOYEE && claim.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (dto.status) {
      const parsedStatus = parseClaimStatus(dto.status);
      if (parsedStatus) dto.status = parsedStatus;
    } else if (dto.notes) {
      try {
        const parsed = JSON.parse(dto.notes);
        if (parsed.uiClaimStatus) {
          const derived = parseClaimStatus(parsed.uiClaimStatus);
          if (derived) dto.status = derived;
        }
      } catch {}
    }

    const fieldLabels: Record<string, string> = {
      claimNumber: 'Claim Number',
      claimType: 'Claim Type',
      claimAmount: 'Claim Amount',
      approvedAmount: 'Approved Amount',
      rejectionReason: 'Rejection Reason',
      diagnosis: 'Diagnosis',
      status: 'Claim Status',
      policyId: 'Policy',
      contactId: 'Contact',
      assignedEmployeeId: 'Assigned Employee',
      hospitalId: 'Hospital',
      settlementType: 'Settlement Type',
      notes: 'Claim Details',
      patientName: 'Patient Name',
      patientRelation: 'Patient Relationship',
      hospitalName: 'Hospital Name',
      hospitalAddress: 'Hospital Address',
      hospitalCity: 'Hospital City',
      hospitalState: 'Hospital State',
      hospitalContactNo: 'Hospital Contact Number',
      admissionDate: 'Admission Date',
      dischargeDate: 'Discharge Date',
      nomineeName: 'Nominee Name',
      nomineePhone: 'Nominee Phone',
      doctors: 'Consulting Doctors',
      expenses: 'Claim Expenses',
      documents: 'Documents',
    };
    const changedFieldNames = Object.keys(dto).flatMap((key) => {
      const oldValue = (claim as any)[key];
      const newValue = (dto as any)[key];
      const normalize = (value: any) => value instanceof Date ? value.toISOString() : value;
      if (JSON.stringify(normalize(oldValue) ?? null) === JSON.stringify(normalize(newValue) ?? null)) return [];

      if (key === 'notes') {
        try {
          const oldNotes = JSON.parse(oldValue || '{}');
          const newNotes = JSON.parse(newValue || '{}');
          if (oldNotes && newNotes && typeof oldNotes === 'object' && typeof newNotes === 'object') {
            const changedNotes = Object.keys(newNotes).filter(
              (noteKey) => JSON.stringify(oldNotes[noteKey] ?? null) !== JSON.stringify(newNotes[noteKey] ?? null),
            );
            if (changedNotes.length) {
              return changedNotes.map((noteKey) => fieldLabels[noteKey] || noteKey.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()));
            }
          }
        } catch {
          // Plain-text notes are reported as a single field below.
        }
      }

      return [fieldLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())];
    });
    const updated = await this.prisma.claim.update({ where: { id }, data: dto as any });
    await this.logActivity(
      tenantId,
      userId,
      updated.contactId,
      id,
      'UPDATE',
      changedFieldNames.length
        ? `Claim details updated: ${[...new Set(changedFieldNames)].join(', ')}`
        : 'Claim details updated',
    );

    if (dto.assignedEmployeeId && dto.assignedEmployeeId !== claim.assignedEmployeeId) {
      await this.notifEngine.notifyAssignment({
        tenantId,
        assignerId: userId,
        assigneeId: dto.assignedEmployeeId,
        recordType: 'Claim',
        recordId: id,
        recordName: updated.claimNumber || 'Claim',
      }).catch(err => this.logger.warn(`Failed sending claim assignment update notification: ${err.message}`));
    }

    return { data: updated, message: 'Claim updated' };
  }

  /** Advance or revert claim status through the lifecycle */
  async updateStatus(tenantId: string, id: string, dto: UpdateClaimStatusDto, userId: string, role?: UserRole) {
    const claim = await this.prisma.claim.findFirst({ where: { id, tenantId } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (role === UserRole.EMPLOYEE && claim.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const updateData: any = { status: dto.status };
    if (dto.approvedAmount !== undefined) updateData.approvedAmount = dto.approvedAmount;
    if (dto.rejectionReason)              updateData.rejectionReason = dto.rejectionReason;
    if (dto.notes) {
      updateData.notes = dto.notes;
    } else if (claim.notes) {
      try {
        const parsed = JSON.parse(claim.notes);
        if (typeof parsed === 'object') {
          const statusUiMap: Record<string, string> = {
            INTIMATED: 'Intimated',
            DOC_COLLECTION: 'Documents Collected from Hospital/Customer',
            FILED: 'Submitted to Company',
            IN_REVIEW: 'Pending for approval',
            APPROVED: 'Approved',
            REJECTED: 'Rejected',
            SETTLED: 'Settled',
          };
          parsed.uiClaimStatus = statusUiMap[dto.status] || dto.status;
          updateData.notes = JSON.stringify(parsed);
        }
      } catch {}
    }
    if (dto.status === 'FILED')           updateData.filedAt   = new Date();
    if (dto.status === 'SETTLED')         updateData.settledAt = dto.settledAt ? new Date(dto.settledAt) : new Date();

    const updated = await this.prisma.claim.update({ where: { id }, data: updateData });

    await this.logActivity(tenantId, userId, updated.contactId, id,
      'STAGE_CHANGE', `Claim status changed to ${dto.status}`);

    // Notify assigned employee of status change
    if (updated.assignedEmployeeId) {
      await this.notifEngine.notifyClaimUpdate(
        tenantId, id, (updated as any).claimNumber ?? id,
        dto.status, updated.assignedEmployeeId,
      );
    }

    return { data: updated, message: `Claim status updated to ${dto.status}` };
  }

  async addExpense(tenantId: string, claimId: string, dto: AddExpenseDto, userId?: string, role?: UserRole) {
    const claim = await this.prisma.claim.findFirst({ where: { id: claimId, tenantId } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (role === UserRole.EMPLOYEE && claim.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    const expense = await this.prisma.claimExpense.create({
      data: { ...dto, claimId, date: new Date(dto.date) },
    });
    await this.logActivity(
      tenantId,
      userId,
      claim.contactId,
      claim.id,
      'CREATE',
      `Claim expense added: ${dto.description} (₹${Number(dto.amount || 0).toLocaleString('en-IN')})`,
    );
    return { data: expense, message: 'Expense added' };
  }

  async remove(tenantId: string, id: string) {
    const claim = await this.prisma.claim.findFirst({ where: { id, tenantId } });
    if (!claim) throw new NotFoundException('Claim not found');
    await this.prisma.claim.delete({ where: { id } });
    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          entityType: 'Claim',
          entityId: id,
          action: 'DELETE',
          description: 'Admin directly deleted the claim',
        }
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed for claim delete: ${err.message}`);
    }
    return { data: null, message: 'Claim deleted' };
  }

  async removeExpense(tenantId: string, claimId: string, expenseId: string, userId?: string, role?: UserRole) {
    const claim = await this.prisma.claim.findFirst({ where: { id: claimId, tenantId } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (role === UserRole.EMPLOYEE && claim.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    await this.prisma.claimExpense.delete({ where: { id: expenseId } });
    return { data: null, message: 'Expense removed' };
  }

  async getStatusSummary(tenantId: string) {
    const statuses = ['INTIMATED', 'FILED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SETTLED'];
    const counts = await Promise.all(
      statuses.map((s) =>
        this.prisma.claim.count({ where: { tenantId, status: s as any } }).then((c) => ({ status: s, count: c })),
      ),
    );
    return { data: counts };
  }

  private async logActivity(
    tenantId: string, userId: string | undefined, contactId: string,
    entityId: string, action: string, description: string,
  ) {
    try {
      await this.prisma.activityLog.create({
        data: { tenantId, ...(userId ? { userId } : {}), contactId, entityType: 'Claim', entityId, action, description },
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed: ${err.message}`);
    }
  }

  async createClaimFull(
    tenantId: string,
    dto: {
      claim: CreateClaimDto;
      expenses?: AddExpenseDto[];
    },
    createdById: string,
    role?: UserRole,
  ) {
    rejectFutureIntimationDate(dto.claim.intimatedAt);

    const exists = await this.prisma.claim.findFirst({
      where: { tenantId, claimNumber: dto.claim.claimNumber },
    });
    if (exists) throw new ConflictException('Claim number already exists');

    const result = await this.prisma.$transaction(async (tx) => {
      const { intimatedAt, ...restDto } = dto.claim as any;

      // Auto-assign to the creating employee when no assignee is provided
      if (role === UserRole.EMPLOYEE && !restDto.assignedEmployeeId) {
        restDto.assignedEmployeeId = createdById;
      }

      const claim = await tx.claim.create({
        data: {
          ...restDto,
          tenantId,
          status: 'INTIMATED',
          intimatedAt: new Date(intimatedAt),
        } as any,
      });

      if (dto.expenses && dto.expenses.length > 0) {
        for (const e of dto.expenses) {
          await tx.claimExpense.create({
            data: {
              ...e,
              claimId: claim.id,
              date: new Date(e.date),
            },
          });
        }
      }

      return claim;
    });

    await this.logActivity(tenantId, createdById, dto.claim.contactId, result.id, 'CREATE',
      `Claim ${dto.claim.claimNumber} intimated with expenses`);

    // Notify assigned employee
    if (dto.claim.assignedEmployeeId) {
      await this.notifEngine.notifyClaimAssigned(
        tenantId, result.id, dto.claim.claimNumber, dto.claim.assignedEmployeeId,
      );
    }

    return { data: result, message: 'Claim profile created successfully' };
  }

  async importClaims(
    tenantId: string,
    createdById: string,
    rows: Array<{
      claimNumber: string;
      status?: string;
      claimType: string;
      claimAmount: string;
      intimatedAt: string;
      policyNumber: string;
      contactPhone: string;
    }>,
    role?: UserRole,
  ) {
    let created = 0;
    const skipped: string[] = [];

    for (const row of rows) {
      if (!row.claimNumber || !row.policyNumber || !row.contactPhone) {
        skipped.push(row.claimNumber || 'unknown');
        continue;
      }

      // Check unique claim number
      const exists = await this.prisma.claim.findFirst({
        where: { tenantId, claimNumber: row.claimNumber },
      });
      if (exists) {
        skipped.push(row.claimNumber);
        continue;
      }

      // Find contact by phone
      const contact = await this.prisma.contact.findFirst({
        where: { tenantId, phone: row.contactPhone },
      });
      if (!contact) {
        skipped.push(`${row.claimNumber} (contact not found)`);
        continue;
      }

      // Find policy by number
      const policy = await this.prisma.policy.findFirst({
        where: { tenantId, policyNumber: row.policyNumber },
      });
      if (!policy) {
        skipped.push(`${row.claimNumber} (policy not found)`);
        continue;
      }

      try {
        const claim = await this.prisma.claim.create({
          data: {
            tenantId,
            claimNumber: row.claimNumber,
            status: (row.status || 'INTIMATED') as any,
            claimType: row.claimType || 'HEALTH',
            claimAmount: parseFloat(row.claimAmount) || 0,
            intimatedAt: new Date(row.intimatedAt || new Date()),
            contactId: contact.id,
            policyId: policy.id,
            // Auto-assign to the importing employee
            ...(role === UserRole.EMPLOYEE ? { assignedEmployeeId: createdById } : {}),
          },
        });

        // Notify assigned employee if any
        if (claim.assignedEmployeeId) {
          await this.notifEngine.notifyClaimAssigned(
            tenantId, claim.id, claim.claimNumber, claim.assignedEmployeeId,
          );
        }

        created++;
      } catch (err: any) {
        this.logger.error(`Failed to import claim ${row.claimNumber}: ${err.message}`);
        skipped.push(row.claimNumber);
      }
    }

    return { created, skipped };
  }
}
