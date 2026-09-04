// ─────────────────────────────────────────────────────────────────────────────
// Policies Service
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, NotFoundException, ConflictException, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreatePolicyDto, UpdatePolicyDto, RecordPaymentDto,
  CreateMemberDto, CreateNomineeDto, PolicyQueryDto,
} from './dto/policy.dto';
import {
  CreatePolicyScenarioDto, UpdatePolicyScenarioDto, PolicyScenarioQueryDto,
} from './dto/policy-scenario.dto';
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

    const where: any = { tenantId, deletedAt: null };
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

    console.log("WHERE::", JSON.stringify(where)); const [data, total] = await Promise.all([
      this.prisma.policy.findMany({
        where,
        skip,
        take:    limit,
        include: {
          contact: { select: { id: true, contactId: true, firstName: true, lastName: true, phone: true } },
          plan:    { include: { company: { select: { name: true } } } },
          assignedEmployee: { include: { employeeProfile: { select: { firstName: true, lastName: true } } } },
          renewedFromPolicy: { select: { id: true, policyNumber: true } },
        },
        orderBy,
      }),
      this.prisma.policy.count({ where }),
    ]);

    const formattedData = data.map((p: any) => {
      const lc = this.computePolicyLifecycleStatus(p);
      return {
        ...p,
        lifecycleStatus: lc.statusKey,
        displayStatus: lc.displayStatus,
      };
    });

    return { data: formattedData, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  computePolicyLifecycleStatus(policy: any, now: Date = new Date()) {
    if (!policy) return { statusKey: 'INFORCE', displayStatus: 'Inforce' };

    const rawStatus = String(policy.status || 'ACTIVE').toUpperCase();
    if (rawStatus === 'INACTIVE_OLD') {
      return { statusKey: 'INACTIVE_OLD', displayStatus: 'Inactive(Old)' };
    }

    if (!policy.endDate) {
      return { statusKey: 'INFORCE', displayStatus: 'Inforce' };
    }

    const end = new Date(policy.endDate);
    const n = new Date(now);
    const todayMs = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();

    const diffDays = Math.round((todayMs - endMs) / (1000 * 60 * 60 * 24));

    if (diffDays < -45) {
      return { statusKey: 'INFORCE', displayStatus: 'Inforce' };
    }
    if (diffDays >= -45 && diffDays <= 0) {
      return { statusKey: 'RENEWAL_DUE', displayStatus: 'Renewal Due' };
    }
    if (diffDays >= 1 && diffDays <= 30) {
      return { statusKey: 'GRACE_PERIOD', displayStatus: `Grace Period - Day ${diffDays} of 30` };
    }
    return { statusKey: 'LAPSED', displayStatus: 'Lapsed' };
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

  async findOne(tenantId: string, id: string, userId: string, role: UserRole) {
    const policy = await this.prisma.policy.findFirst({
      where: { id, tenantId },
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
        renewedFromPolicy: { select: { id: true, policyNumber: true, status: true } },
        renewedPolicies:   { select: { id: true, policyNumber: true, status: true, startDate: true } },
      },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    if (role === UserRole.EMPLOYEE && policy.assignedEmployeeId && policy.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const lc = this.computePolicyLifecycleStatus(policy);
    return {
      data: {
        ...policy,
        lifecycleStatus: lc.statusKey,
        displayStatus: lc.displayStatus,
      },
    };
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

    const parsedStart = startDate ? new Date(startDate) : new Date();
    const parsedEnd = endDate ? new Date(endDate) : new Date();

    const exists = await this.prisma.policy.findFirst({
      where: { tenantId, policyNumber },
    });

    // Handle Renewal Policy Behavior & Previous Policy Link
    const rawRenewedFrom = (dto as any).renewedFromPolicyId || (dto as any).previousPolicyId;
    let renewedFromPolicyId: string | undefined = undefined;
    let isRenewalCase = false;

    if (rawRenewedFrom && isValidObjectId(rawRenewedFrom)) {
      const prevPolicy = await this.prisma.policy.findFirst({
        where: { id: rawRenewedFrom, tenantId },
      });
      if (!prevPolicy) {
        throw new NotFoundException('Previous policy for renewal not found');
      }

      // Check for duplicate active renewal for the same previous policy
      const existingRenewal = await this.prisma.policy.findFirst({
        where: {
          tenantId,
          renewedFromPolicyId: prevPolicy.id,
          deletedAt: null,
        },
      });

      if (existingRenewal && (!exists || exists.id !== existingRenewal.id)) {
        throw new ConflictException(`An active renewal policy (${existingRenewal.policyNumber}) already exists for previous policy #${prevPolicy.policyNumber}`);
      }

      renewedFromPolicyId = prevPolicy.id;
      isRenewalCase = true;
    }

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
      businessType: (dto as any).businessType || (isRenewalCase ? 'RENEWAL' : 'FRESH'),
      ...(renewedFromPolicyId ? { renewedFromPolicyId } : {}),
      ...(maturityDate ? { maturityDate: new Date(maturityDate) } : {}),
      ...(nextDueDate ? { nextDueDate: new Date(nextDueDate) } : {}),
      ...(agentCode ? { agentCode } : {}),
      ...(notes ? { notes } : {}),
      ...(assignedEmployeeId ? { assignedEmployeeId } : {}),
    };

    let policy: any;
    if (exists && isRenewalCase && exists.id === renewedFromPolicyId) {
      // Auto-append suffix to allow creating a brand new record and preserving the original
      policyData.policyNumber = `${policyNumber}-REN${Date.now().toString().slice(-4)}`;
      policy = await this.prisma.policy.create({
        data: policyData,
      });
    } else if (exists) {
      policy = await this.prisma.policy.update({
        where: { id: exists.id },
        data: policyData,
      });
    } else {
      policy = await this.prisma.policy.create({
        data: policyData,
      });
    }

    // Update previous policy status -> INACTIVE_OLD only after successful creation
    if (renewedFromPolicyId) {
      await this.prisma.policy.update({
        where: { id: renewedFromPolicyId },
        data: { status: 'INACTIVE_OLD' as any },
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
      data:  { deletedAt: new Date() },
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

  async getCopyDetails(tenantId: string, policyId: string) {
    const policy = await this.prisma.policy.findFirst({
      where: { id: policyId, tenantId },
      include: {
        contact: true,
        plan: { include: { company: true } },
        members: true,
        nominees: true,
      },
    });

    if (!policy) {
      throw new NotFoundException('Policy to copy from was not found');
    }

    return {
      data: {
        contactId: policy.contactId,
        contactName: policy.contact ? `${policy.contact.firstName || ''} ${policy.contact.lastName || ''}`.trim() : '',
        planId: policy.planId,
        companyId: policy.plan?.companyId || policy.plan?.company?.id,
        policyType: policy.plan?.category || 'HEALTH',
        sumAssured: policy.sumAssured,
        premiumAmount: policy.premiumAmount,
        paymentFrequency: policy.paymentFrequency,
        agentCode: policy.agentCode,
        assignedEmployeeId: policy.assignedEmployeeId,
        customerCategory: (policy as any).customerCategory || 'INDIVIDUAL',
        notes: policy.notes,
        members: (policy.members || []).map((m: any) => ({
          name: m.name,
          relationship: m.relationship,
          dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth).toISOString().split('T')[0] : undefined,
          gender: m.gender,
          sumInsured: m.sumInsured,
        })),
        nominees: (policy.nominees || []).map((n: any) => ({
          name: n.name,
          relationship: n.relationship,
          dateOfBirth: n.dateOfBirth ? new Date(n.dateOfBirth).toISOString().split('T')[0] : undefined,
          sharePercent: n.sharePercent,
          phone: n.phone,
        })),
        previousPolicyNumber: policy.policyNumber,
        renewedFromPolicyId: policy.id,
      },
    };
  }

  async syncPolicyStatuses(tenantId?: string) {
    const now = new Date();
    const policies = await this.prisma.policy.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        deletedAt: null,
        status: { notIn: ['INACTIVE_OLD' as any] },
      },
      select: { id: true, endDate: true, status: true },
    });

    let updatedCount = 0;
    for (const p of policies) {
      const lc = this.computePolicyLifecycleStatus(p, now);
      if (lc && lc.statusKey && p.status !== (lc.statusKey as any)) {
        await this.prisma.policy.update({
          where: { id: p.id },
          data: { status: lc.statusKey as any },
        });
        updatedCount++;
      }
    }

    return { scanned: policies.length, updated: updatedCount };
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

  // ── Policy Scenario Operations ───────────────────────────────────────────

  async findAllScenarios(tenantId: string, query?: PolicyScenarioQueryDto) {
    const where: any = { tenantId };

    if (query?.policyType) {
      where.policyType = { equals: query.policyType, mode: 'insensitive' };
    }
    if (query?.businessType) {
      where.businessType = { equals: query.businessType, mode: 'insensitive' };
    }
    if (query?.companyId) {
      where.companyId = query.companyId;
    }
    if (query?.planId) {
      where.planId = query.planId;
    }
    if (query?.isActive !== undefined) {
      where.isActive = query.isActive === 'true' || query.isActive === true;
    }

    const scenarios = await (this.prisma as any).policyScenario.findMany({
      where,
      include: {
        company: { select: { id: true, name: true, shortCode: true } },
        plan: { select: { id: true, name: true, planCode: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: scenarios };
  }

  async lookupScenario(tenantId: string, policyType?: string, businessType?: string, companyId?: string, planId?: string) {
    if (!policyType || !businessType || !companyId || !planId) {
      return { data: null };
    }

    // Try exact lookup (case-insensitive on strings)
    let scenario = await (this.prisma as any).policyScenario.findFirst({
      where: {
        tenantId,
        companyId,
        planId,
        policyType: { equals: policyType, mode: 'insensitive' },
        businessType: { equals: businessType, mode: 'insensitive' },
        isActive: true,
      },
      include: {
        company: { select: { id: true, name: true, shortCode: true } },
        plan: { select: { id: true, name: true, planCode: true, category: true } },
      },
    });

    // Fallback if specific planId didn't match, check companyId + policyType + businessType
    if (!scenario) {
      scenario = await (this.prisma as any).policyScenario.findFirst({
        where: {
          tenantId,
          companyId,
          policyType: { equals: policyType, mode: 'insensitive' },
          businessType: { equals: businessType, mode: 'insensitive' },
          isActive: true,
        },
        include: {
          company: { select: { id: true, name: true, shortCode: true } },
          plan: { select: { id: true, name: true, planCode: true, category: true } },
        },
      });
    }

    return { data: scenario };
  }

  async createScenario(tenantId: string, dto: CreatePolicyScenarioDto) {
    // 1. Verify Company exists in tenant master data
    const company = await this.prisma.insuranceCompany.findFirst({
      where: { id: dto.companyId, tenantId },
    });
    if (!company) {
      throw new BadRequestException('Selected Insurance Company does not exist in master data');
    }

    // 2. Verify Plan exists in tenant master data & belongs to company
    const plan = await this.prisma.insurancePlan.findFirst({
      where: { id: dto.planId, tenantId, companyId: dto.companyId },
    });
    if (!plan) {
      throw new BadRequestException('Selected Insurance Plan does not exist or does not belong to the selected company');
    }

    // 3. Prevent duplicate scenarios
    const normPolicyType = dto.policyType.toUpperCase().trim();
    const normBusinessType = dto.businessType.toUpperCase().trim();

    const existing = await (this.prisma as any).policyScenario.findFirst({
      where: {
        tenantId,
        companyId: dto.companyId,
        planId: dto.planId,
        policyType: { equals: normPolicyType, mode: 'insensitive' },
        businessType: { equals: normBusinessType, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(`A scenario configuration already exists for Policy Type "${dto.policyType}", Business Type "${dto.businessType}", and Plan "${plan.name}"`);
    }

    const scenario = await (this.prisma as any).policyScenario.create({
      data: {
        tenantId,
        policyType: normPolicyType,
        businessType: normBusinessType,
        companyId: dto.companyId,
        planId: dto.planId,
        policyPeriods: dto.policyPeriods || [],
        paymentOptions: dto.paymentOptions || [],
        emiMonths: dto.emiMonths || [],
        paymentTerms: dto.paymentTerms || [],
        isActive: dto.isActive ?? true,
      },
      include: {
        company: { select: { id: true, name: true, shortCode: true } },
        plan: { select: { id: true, name: true, planCode: true, category: true } },
      },
    });

    return { data: scenario, message: 'Policy scenario created successfully' };
  }

  async updateScenario(tenantId: string, id: string, dto: UpdatePolicyScenarioDto) {
    const existing = await (this.prisma as any).policyScenario.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Policy scenario configuration not found');
    }

    if (dto.companyId) {
      const company = await this.prisma.insuranceCompany.findFirst({
        where: { id: dto.companyId, tenantId },
      });
      if (!company) {
        throw new BadRequestException('Selected Insurance Company does not exist in master data');
      }
    }

    if (dto.planId) {
      const targetCompanyId = dto.companyId || existing.companyId;
      const plan = await this.prisma.insurancePlan.findFirst({
        where: { id: dto.planId, tenantId, companyId: targetCompanyId },
      });
      if (!plan) {
        throw new BadRequestException('Selected Insurance Plan does not exist or does not belong to the selected company');
      }
    }

    // Check duplicate if policyType/businessType/companyId/planId changed
    const targetPolicyType = (dto.policyType || existing.policyType).toUpperCase().trim();
    const targetBusinessType = (dto.businessType || existing.businessType).toUpperCase().trim();
    const targetCompanyId = dto.companyId || existing.companyId;
    const targetPlanId = dto.planId || existing.planId;

    const dup = await (this.prisma as any).policyScenario.findFirst({
      where: {
        tenantId,
        id: { not: id },
        companyId: targetCompanyId,
        planId: targetPlanId,
        policyType: { equals: targetPolicyType, mode: 'insensitive' },
        businessType: { equals: targetBusinessType, mode: 'insensitive' },
      },
    });
    if (dup) {
      throw new ConflictException(`Another scenario configuration already exists for this combination`);
    }

    const updated = await (this.prisma as any).policyScenario.update({
      where: { id },
      data: {
        ...(dto.policyType ? { policyType: targetPolicyType } : {}),
        ...(dto.businessType ? { businessType: targetBusinessType } : {}),
        ...(dto.companyId ? { companyId: dto.companyId } : {}),
        ...(dto.planId ? { planId: dto.planId } : {}),
        ...(dto.policyPeriods ? { policyPeriods: dto.policyPeriods } : {}),
        ...(dto.paymentOptions ? { paymentOptions: dto.paymentOptions } : {}),
        ...(dto.emiMonths ? { emiMonths: dto.emiMonths } : {}),
        ...(dto.paymentTerms ? { paymentTerms: dto.paymentTerms } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        company: { select: { id: true, name: true, shortCode: true } },
        plan: { select: { id: true, name: true, planCode: true, category: true } },
      },
    });

    return { data: updated, message: 'Policy scenario updated successfully' };
  }

  async toggleScenarioStatus(tenantId: string, id: string, isActive: boolean) {
    const existing = await (this.prisma as any).policyScenario.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Policy scenario configuration not found');
    }

    const updated = await (this.prisma as any).policyScenario.update({
      where: { id },
      data: { isActive },
    });

    return { data: updated, message: `Scenario ${isActive ? 'activated' : 'deactivated'} successfully` };
  }

  async deleteScenario(tenantId: string, id: string) {
    const existing = await (this.prisma as any).policyScenario.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Policy scenario configuration not found');
    }

    await (this.prisma as any).policyScenario.delete({
      where: { id },
    });

    return { message: 'Policy scenario deleted successfully' };
  }
}
