// ─────────────────────────────────────────────────────────────────────────────
// Claims Service — manages the full claim lifecycle
// INTIMATED → FILED → IN_REVIEW → APPROVED/REJECTED → SETTLED
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, NotFoundException, ConflictException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import {
  CreateClaimDto, UpdateClaimDto, UpdateClaimStatusDto,
  AddExpenseDto, ClaimQueryDto,
} from './dto/claim.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifEngine: NotificationEngineService,
  ) {}

  async findAll(tenantId: string, userId: string, role: UserRole, query: ClaimQueryDto) {
    const page  = Math.max(1, parseInt(String((query as any).page  ?? 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String((query as any).limit ?? 20), 10) || 20));
    const { status, search, claimType, assignedEmployeeId, sortBy, sortOrder } = query as any;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (role === UserRole.EMPLOYEE) {
      where.assignedEmployeeId = userId;
    } else if (assignedEmployeeId) {
      where.assignedEmployeeId = assignedEmployeeId === 'UNASSIGNED' ? null : assignedEmployeeId;
    }
    if (status)    where.status    = status;
    if (claimType) where.claimType = claimType;
    if (search) {
      where.OR = [
        { claimNumber: { contains: search, mode: 'insensitive' } },
        { contact: { firstName: { contains: search, mode: 'insensitive' } } },
        { contact: { phone: { contains: search } } },
        { policy: { policyNumber: { contains: search, mode: 'insensitive' } } },
      ];
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
        policy:   { include: { plan: { include: { company: true } } } },
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

    const claim = await this.prisma.claim.create({
      data: { ...restDto, tenantId, status: 'INTIMATED', intimatedAt: new Date(intimatedAt) } as any,
    });

    await this.logActivity(tenantId, createdById, dto.contactId, claim.id, 'CREATE',
      `Claim ${dto.claimNumber} intimated for ${dto.claimType}`);

    // Notify assigned employee
    if (dto.assignedEmployeeId) {
      await this.notifEngine.notifyClaimAssigned(
        tenantId, claim.id, dto.claimNumber, dto.assignedEmployeeId,
      );
    }

    return { data: claim, message: 'Claim created successfully' };
  }

  async update(tenantId: string, id: string, dto: UpdateClaimDto, userId: string, role?: UserRole) {
    const claim = await this.prisma.claim.findFirst({ where: { id, tenantId } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (role === UserRole.EMPLOYEE && claim.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.claim.update({ where: { id }, data: dto as any });
    await this.logActivity(tenantId, userId, updated.contactId, id, 'UPDATE', 'Claim details updated');
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
    if (dto.notes)                        updateData.notes = dto.notes;
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
    tenantId: string, userId: string, contactId: string,
    entityId: string, action: string, description: string,
  ) {
    try {
      await this.prisma.activityLog.create({
        data: { tenantId, userId, contactId, entityType: 'Claim', entityId, action, description },
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
