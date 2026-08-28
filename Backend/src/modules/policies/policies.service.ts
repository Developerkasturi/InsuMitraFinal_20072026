// ─────────────────────────────────────────────────────────────────────────────
// Policies Service
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, NotFoundException, ConflictException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreatePolicyDto, UpdatePolicyDto, RecordPaymentDto,
  CreateMemberDto, CreateNomineeDto, PolicyQueryDto,
} from './dto/policy.dto';
import { UserRole } from '@prisma/client';

import { LeadsService } from '../leads/leads.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsService: LeadsService,
    private readonly notifEngine: NotificationEngineService,
  ) {}

  async findAll(tenantId: string, userId: string, role: UserRole, query: PolicyQueryDto) {
    const { status, search, contactId, planId, sortBy, sortOrder, endDateFrom, endDateTo, nextDueDateFrom, nextDueDateTo } = query as any;
    const page  = Math.max(1, parseInt(String((query as any).page  ?? 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String((query as any).limit ?? 20), 10) || 20));
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
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
    }
    if (status)    where.status    = status;
    if (contactId) where.contactId = contactId;
    if (planId)    where.planId    = planId;
    if (endDateFrom || endDateTo) {
      where.endDate = {};
      if (endDateFrom) where.endDate.gte = new Date(endDateFrom);
      if (endDateTo)   where.endDate.lte = new Date(endDateTo);
    }
    if (nextDueDateFrom || nextDueDateTo) {
      where.nextDueDate = {};
      if (nextDueDateFrom) where.nextDueDate.gte = new Date(nextDueDateFrom);
      if (nextDueDateTo)   where.nextDueDate.lte = new Date(nextDueDateTo);
    }
    if (search) {
      where.OR = [
        { policyNumber: { contains: search, mode: 'insensitive' } },
        { contact: { firstName: { contains: search, mode: 'insensitive' } } },
        { contact: { lastName:  { contains: search, mode: 'insensitive' } } },
        { contact: { phone:     { contains: search } } },
      ];
    }

    const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';
    let orderBy: any = { createdAt: orderDir };

    if (sortBy) {
      if (sortBy === 'contact.firstName') {
        orderBy = { contact: { firstName: orderDir } };
      } else if (sortBy === 'plan.name') {
        orderBy = { plan: { name: orderDir } };
      } else if (sortBy === 'plan.company.name') {
        orderBy = { plan: { company: { name: orderDir } } };
      } else if (sortBy === 'plan.category') {
        orderBy = { plan: { category: orderDir } };
      } else if (sortBy === 'assignedEmployee.employeeProfile.firstName') {
        orderBy = { assignedEmployee: { employeeProfile: { firstName: orderDir } } };
      } else {
        orderBy = { [sortBy]: orderDir };
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.policy.findMany({
        where,
        skip,
        take:    limit,
        include: {
          contact: { select: { id: true, contactId: true, firstName: true, lastName: true, phone: true } },
          plan:    { include: { company: { select: { name: true } } } },
          assignedEmployee: { include: { employeeProfile: { select: { firstName: true, lastName: true } } } },
        },
        orderBy,
      }),
      this.prisma.policy.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async listInsurancePlans(tenantId: string, search?: string) {
    const where: any = { tenantId, isActive: true };
    if (search) {
      where.OR = [
        { name:     { contains: search, mode: 'insensitive' } },
        { planCode: { contains: search, mode: 'insensitive' } },
        { company:  { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const plans = await this.prisma.insurancePlan.findMany({
      where,
      include: { company: { select: { name: true, shortCode: true } } },
      orderBy: { name: 'asc' },
      take: 50,
    });
    return { data: plans };
  }

  async findOne(tenantId: string, id: string, userId?: string, role?: UserRole) {
    const policy = await this.prisma.policy.findFirst({
      where:   { id, tenantId },
      include: {
        contact:   true,
        plan:      { include: { company: true } },
        members:   true,
        payments:  { orderBy: { dueDate: 'asc' } },
        loans:     true,
        nominees:  true,
        healthCheckups: { orderBy: { scheduledAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        claims:    { select: { id: true, claimNumber: true, status: true, claimAmount: true } },
        commissions: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    if (role === UserRole.EMPLOYEE && policy.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return { data: policy };
  }

  async create(tenantId: string, dto: CreatePolicyDto, createdById: string, role?: UserRole) {
    const {
      policyNumber,
      contactId: rawContactId,
      planId: rawPlanId,
      assignedEmployeeId: rawEmployeeId,
      status,
      sumAssured,
      premiumAmount,
      paymentFrequency,
      startDate,
      endDate,
      maturityDate,
      nextDueDate,
      agentCode,
      notes,
    } = dto as any;

    const isValidObjectId = (id?: string) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    let contactId = rawContactId;
    if (contactId && !isValidObjectId(contactId)) {
      const contactObj = await this.prisma.contact.findFirst({
        where: {
          OR: [
            { contactId },
            { phone: contactId },
            { email: contactId },
          ],
        },
        select: { id: true },
      });
      if (contactObj) {
        contactId = contactObj.id;
      }
    }
    if (!isValidObjectId(contactId)) {
      const fallbackContact = await this.prisma.contact.findFirst({
        select: { id: true },
      });
      contactId = fallbackContact?.id;
    }

    let planId = rawPlanId;
    if (planId && !isValidObjectId(planId)) {
      const planObj = await this.prisma.insurancePlan.findFirst({
        where: {
          OR: [
            { name: planId },
            { category: planId },
          ],
        },
        select: { id: true },
      });
      if (planObj) {
        planId = planObj.id;
      }
    }
    if (!isValidObjectId(planId)) {
      const fallbackPlan = await this.prisma.insurancePlan.findFirst({
        select: { id: true },
      });
      planId = fallbackPlan?.id;
    }

    let assignedEmployeeId = rawEmployeeId;
    if (!isValidObjectId(assignedEmployeeId)) {
      assignedEmployeeId = undefined;
    }

    if (role === UserRole.EMPLOYEE && !assignedEmployeeId) {
      assignedEmployeeId = createdById;
    }

    const exists = await this.prisma.policy.findFirst({
      where: { tenantId, policyNumber },
    });

    const parsedStart = startDate ? new Date(startDate) : new Date();
    const parsedEnd = endDate ? new Date(endDate) : new Date();

    const policyData: any = {
      tenantId,
      policyNumber,
      contactId,
      planId,
      status: status || 'ACTIVE',
      sumAssured: sumAssured ? Number(sumAssured) : 0,
      premiumAmount: premiumAmount ? Number(premiumAmount) : 0,
      paymentFrequency: paymentFrequency || 'YEARLY',
      startDate: parsedStart,
      endDate: parsedEnd,
      ...(maturityDate ? { maturityDate: new Date(maturityDate) } : {}),
      ...(nextDueDate ? { nextDueDate: new Date(nextDueDate) } : {}),
      ...(agentCode ? { agentCode } : {}),
      ...(notes ? { notes } : {}),
      ...(assignedEmployeeId ? { assignedEmployeeId } : {}),
    };

    let policy: any;
    if (exists) {
      policy = await this.prisma.policy.update({
        where: { id: exists.id },
        data: policyData,
      });
    } else {
      policy = await this.prisma.policy.create({
        data: policyData,
      });
    }

    // Auto-create renewal calendar event
    try {
      await this.prisma.calendarEvent.create({
        data: {
          tenantId,
          contactId:   policy.contactId,
          title:       `Policy Renewal — ${policy.policyNumber}`,
          eventType:   'RENEWAL',
          startAt:     new Date(policy.endDate),
          isAutomatic: true,
          relatedId:   policy.id,
        },
      });
    } catch (calErr: any) {
      this.logger.warn(`Calendar event creation notice: ${calErr.message}`);
    }

    // Auto-create payment due events based on frequency
    try {
      await this.generatePaymentSchedule(tenantId, policy.id, {
        ...dto,
        startDate: policy.startDate as any,
        endDate: policy.endDate as any,
      });
    } catch (schedErr: any) {
      this.logger.warn(`Payment schedule notice: ${schedErr.message}`);
    }

    await this.logActivity(tenantId, createdById, policy.contactId, policy.id, 'CREATE', `Policy ${policy.policyNumber} created`);

    // Auto-create renewal leads immediately for expiring policies
    this.leadsService.autoCreateRenewalLeads(tenantId).catch(e => this.logger.warn(`Auto-renewal lead error: ${e.message}`));

    return { data: policy, message: 'Policy created successfully' };
  }

  async update(tenantId: string, id: string, dto: UpdatePolicyDto, userId: string, role?: UserRole) {
    const policy = await this.prisma.policy.findFirst({ where: { id, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    if (role === UserRole.EMPLOYEE && policy.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const { startDate, endDate, maturityDate, nextDueDate, ...rest } = dto as any;
    const updated = await this.prisma.policy.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate    ? { startDate:    new Date(startDate)    } : {}),
        ...(endDate      ? { endDate:      new Date(endDate)      } : {}),
        ...(maturityDate ? { maturityDate: new Date(maturityDate) } : {}),
        ...(nextDueDate  ? { nextDueDate:  new Date(nextDueDate)  } : {}),
      } as any,
    });
    await this.logActivity(tenantId, userId, updated.contactId, id, 'UPDATE', 'Policy updated');

    // Auto-create renewal leads immediately for expiring policies
    this.leadsService.autoCreateRenewalLeads(tenantId).catch(e => this.logger.warn(`Auto-renewal lead error: ${e.message}`));

    return { data: updated, message: 'Policy updated' };
  }

  async remove(tenantId: string, id: string) {
    const policy = await this.prisma.policy.findFirst({ where: { id, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    await this.prisma.policy.update({
      where: { id },
      data:  { status: 'CANCELLED' }, // or soft delete
    });
    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          entityType: 'Policy',
          entityId: id,
          action: 'DELETE',
          description: 'Admin directly deleted the policy',
        }
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed for policy delete: ${err.message}`);
    }
    return { data: null, message: 'Policy cancelled' };
  }

  // ── Members ───────────────────────────────────────────────────────────────

  async addMember(tenantId: string, policyId: string, dto: CreateMemberDto, userId?: string, role?: UserRole) {
    const policy = await this.prisma.policy.findFirst({ where: { id: policyId, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    if (role === UserRole.EMPLOYEE && policy.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    const member = await this.prisma.policyMember.create({
      data: { ...dto, policyId },
    });
    return { data: member, message: 'Member added' };
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  async recordPayment(tenantId: string, policyId: string, dto: RecordPaymentDto, userId?: string, role?: UserRole) {
    const policy = await this.prisma.policy.findFirst({ where: { id: policyId, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    if (role === UserRole.EMPLOYEE && policy.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    // Default dueDate to today when caller omits it
    const effectiveDueDate = dto.dueDate ? new Date(dto.dueDate) : new Date();
    const payment = await this.prisma.policyPayment.create({
      data: { ...dto, dueDate: effectiveDueDate, policyId } as any,
    });

    // Compute next due date based on frequency
    if (dto.isPaid) {
      const nextDue = this.computeNextDueDate(effectiveDueDate, policy.paymentFrequency);
      await this.prisma.policy.update({ where: { id: policyId }, data: { nextDueDate: nextDue } });
    }

    return { data: payment, message: 'Payment recorded' };
  }

  // ── Nominees ──────────────────────────────────────────────────────────────

  async removeMember(tenantId: string, policyId: string, memberId: string) {
    const policy = await this.prisma.policy.findFirst({ where: { id: policyId, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    await this.prisma.policyMember.deleteMany({ where: { id: memberId, policyId } });
    return { data: null, message: 'Member removed' };
  }

  async addNominee(tenantId: string, policyId: string, dto: CreateNomineeDto, userId?: string, role?: UserRole) {
    const policy = await this.prisma.policy.findFirst({ where: { id: policyId, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    if (role === UserRole.EMPLOYEE && policy.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    const nominee = await this.prisma.policyNominee.create({ data: { ...dto, policyId } });
    return { data: nominee, message: 'Nominee added' };
  }

  async removeNominee(tenantId: string, policyId: string, nomineeId: string) {
    const policy = await this.prisma.policy.findFirst({ where: { id: policyId, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    await this.prisma.policyNominee.deleteMany({ where: { id: nomineeId, policyId } });
    return { data: null, message: 'Nominee removed' };
  }

  // ── Expiring policies (for reminders) ────────────────────────────────────

  async getExpiringSoon(tenantId: string, days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return this.prisma.policy.findMany({
      where: {
        tenantId,
        status:  'ACTIVE',
        endDate: { lte: cutoff, gte: new Date() },
      },
      include: { contact: true, plan: { include: { company: true } } },
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private computeNextDueDate(from: Date, frequency: string): Date {
    const next = new Date(from);
    switch (frequency) {
      case 'MONTHLY':      next.setMonth(next.getMonth() + 1);   break;
      case 'QUARTERLY':    next.setMonth(next.getMonth() + 3);   break;
      case 'HALF_YEARLY':  next.setMonth(next.getMonth() + 6);   break;
      case 'YEARLY':       next.setFullYear(next.getFullYear() + 1); break;
    }
    return next;
  }

  private async generatePaymentSchedule(tenantId: string, policyId: string, dto: CreatePolicyDto) {
    const rawStart = dto.startDate ? new Date(dto.startDate) : new Date();
    const rawEnd = dto.endDate ? new Date(dto.endDate) : new Date();
    const amount = dto.premiumAmount ?? 0;

    // Only generate for non-SINGLE policies
    if (dto.paymentFrequency === 'SINGLE') {
      await this.prisma.policyPayment.create({
        data: { policyId, amount, dueDate: rawStart },
      });
      return;
    }

    // Generate upcoming payment records up to the endDate
    let dueDate = rawStart;

    while (dueDate <= rawEnd) {
      await this.prisma.policyPayment.create({
        data: { policyId, amount, dueDate: new Date(dueDate) },
      });
      dueDate = this.computeNextDueDate(dueDate, dto.paymentFrequency);
    }
  }

  private async logActivity(
    tenantId: string, userId: string, contactId: string,
    entityId: string, action: string, description: string,
  ) {
    try {
      await this.prisma.activityLog.create({
        data: { tenantId, userId, contactId, entityType: 'Policy', entityId, action, description },
      });
    } catch (err: any) {
      console.error('[logActivity ERROR]', err);
      this.logger.warn(`ActivityLog write failed: ${err.message}`);
    }
  }

  async createPolicyFull(
    tenantId: string,
    dto: {
      policy: CreatePolicyDto;
      members?: CreateMemberDto[];
      nominees?: CreateNomineeDto[];
    },
    createdById: string,
    role?: UserRole,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const { data: policy } = await this.create(tenantId, dto.policy, createdById, role);

      if (dto.members && dto.members.length > 0) {
        for (const m of dto.members) {
          await tx.policyMember.create({
            data: { ...m, policyId: policy.id },
          });
        }
      }

      if (dto.nominees && dto.nominees.length > 0) {
        for (const n of dto.nominees) {
          await tx.policyNominee.create({
            data: { ...n, policyId: policy.id, sharePercent: (n as any).sharePercent ?? (n as any).sharePercentage ?? 100 },
          });
        }
      }

      return policy;
    });

    // Auto-create renewal calendar event
    try {
      if (result.contactId && result.endDate) {
        await this.prisma.calendarEvent.create({
          data: {
            tenantId,
            contactId:   result.contactId,
            title:       `Policy Renewal — ${result.policyNumber}`,
            eventType:   'RENEWAL',
            startAt:     new Date(result.endDate),
            isAutomatic: true,
            relatedId:   result.id,
          },
        });
      }
    } catch { /* ignore */ }

    // Auto-generate payment schedule
    try {
      await this.generatePaymentSchedule(tenantId, result.id, dto.policy);
    } catch { /* ignore */ }

    if (result.contactId) {
      await this.logActivity(tenantId, createdById, result.contactId, result.id, 'CREATE', `Policy ${result.policyNumber} created with full profile`);
    }

    return { data: result, message: 'Policy profile created successfully' };
  }

  async importPolicies(
    tenantId: string,
    createdById: string,
    rows: Array<{
      policyNumber: string;
      status?: string;
      sumAssured: string;
      premiumAmount: string;
      paymentFrequency: string;
      startDate: string;
      endDate: string;
      contactPhone: string;
      planCode?: string;
    }>,
    role?: UserRole,
  ) {
    let created = 0;
    const skipped: string[] = [];

    for (const row of rows) {
      if (!row.policyNumber || !row.contactPhone) {
        skipped.push(row.policyNumber || 'unknown');
        continue;
      }

      // Check unique policy number
      const exists = await this.prisma.policy.findFirst({
        where: { tenantId, policyNumber: row.policyNumber },
      });
      if (exists) {
        skipped.push(row.policyNumber);
        continue;
      }

      // Find contact by phone
      const contact = await this.prisma.contact.findFirst({
        where: { tenantId, phone: row.contactPhone },
      });
      if (!contact) {
        skipped.push(`${row.policyNumber} (contact not found)`);
        continue;
      }

      // Find plan by planCode, or default to some plan
      let planId: string | null = null;
      if (row.planCode) {
        const plan = await this.prisma.insurancePlan.findFirst({
          where: { tenantId, planCode: row.planCode },
        });
        if (plan) planId = plan.id;
      }

      if (!planId) {
        const plan = await this.prisma.insurancePlan.findFirst({
          where: { tenantId, isActive: true },
        });
        if (plan) planId = plan.id;
      }

      if (!planId) {
        skipped.push(`${row.policyNumber} (no active insurance plans available)`);
        continue;
      }

      try {
        const policy = await this.prisma.policy.create({
          data: {
            tenantId,
            policyNumber: row.policyNumber,
            status: (row.status || 'ACTIVE') as any,
            sumAssured: parseFloat(row.sumAssured) || 100000,
            premiumAmount: parseFloat(row.premiumAmount) || 5000,
            paymentFrequency: (row.paymentFrequency || 'YEARLY') as any,
            startDate: new Date(row.startDate || new Date()),
            endDate: new Date(row.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
            contactId: contact.id,
            planId,
            // Auto-assign to the importing employee
            ...(role === UserRole.EMPLOYEE ? { assignedEmployeeId: createdById } : {}),
          },
        });

        // Auto-create calendar events and payment schedule
        await this.prisma.calendarEvent.create({
          data: {
            tenantId,
            contactId: contact.id,
            title: `Policy Renewal — ${row.policyNumber}`,
            eventType: 'RENEWAL',
            startAt: new Date(row.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
            isAutomatic: true,
            relatedId: policy.id,
          },
        });

        await this.generatePaymentSchedule(tenantId, policy.id, {
          paymentFrequency: row.paymentFrequency,
          premiumAmount: parseFloat(row.premiumAmount) || 5000,
          startDate: row.startDate || new Date(),
          endDate: row.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          contactId: contact.id,
        } as any);

        created++;
      } catch (err: any) {
        this.logger.error(`Failed to import policy ${row.policyNumber}: ${err.message}`);
        skipped.push(row.policyNumber);
      }
    }

    return { created, skipped };
  }

  async bulkAssign(tenantId: string, ids: string[], assignedEmployeeId: string | null, userId: string, role: UserRole) {
    if (role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to bulk assign policies');
    }

    if (assignedEmployeeId) {
      const targetUser = await this.prisma.user.findFirst({
        where: { id: assignedEmployeeId, tenantId },
      });
      if (!targetUser) {
        throw new NotFoundException('Assignee not found in this tenant');
      }
    }

    const policies = await this.prisma.policy.findMany({
      where: { id: { in: ids }, tenantId },
      select: { id: true, policyNumber: true, contactId: true },
    });

    const updated = await this.prisma.policy.updateMany({
      where: { id: { in: ids }, tenantId },
      data: { assignedEmployeeId },
    });

    for (const policy of policies) {
      await this.logActivity(
        tenantId,
        userId,
        policy.contactId,
        policy.id,
        'UPDATE',
        `Policy bulk reassigned to ${assignedEmployeeId || 'unassigned'}`,
      );

      if (assignedEmployeeId) {
        await this.notifEngine.notifyAssignment({
          tenantId,
          assignerId: userId,
          assigneeId: assignedEmployeeId,
          recordType: 'Policy',
          recordId: policy.id,
          recordName: policy.policyNumber || 'Policy',
        }).catch(err => this.logger.warn(`Failed sending policy assignment notification: ${err.message}`));
      }
    }

    return { count: updated.count, message: `${updated.count} policies successfully reassigned` };
  }
}
