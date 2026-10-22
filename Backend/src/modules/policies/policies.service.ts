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
import { activityValuesDiffer, formatActivityChange } from '../../common/utils/activity-change.util';

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

    const andConditions: any[] = [
      {
        OR: [
          { deletedAt: null },
          { deletedAt: { isSet: false } },
        ],
      },
    ];

    if (role === UserRole.EMPLOYEE) {
      const empProfile = await this.prisma.employeeProfile.findFirst({
        where: { userId, tenantId },
        select: { id: true },
      });
      const validIds = [userId];
      if (empProfile?.id) validIds.push(empProfile.id);

      andConditions.push({
        OR: [
          { assignedEmployeeId: null },
          { assignedEmployeeId: { isSet: false } },
          { assignedEmployeeId: { in: validIds } },
        ],
      });
    }

    if (search) {
      const cleanSearch = search.trim();
      const tokens = cleanSearch.split(/\s+/).filter(Boolean);
      const searchOr: any[] = [
        { policyNumber: { contains: cleanSearch, mode: 'insensitive' } },
        { contact: { firstName: { contains: cleanSearch, mode: 'insensitive' } } },
        { contact: { lastName:  { contains: cleanSearch, mode: 'insensitive' } } },
        { contact: { phone:     { contains: cleanSearch } } },
      ];
      if (tokens.length >= 2) {
        searchOr.push(
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
      andConditions.push({ OR: searchOr });
    }

    const where: any = { tenantId, AND: andConditions };
    if (status)    where.status    = status;
    if (contactId) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(contactId);
      const targetContact = await this.prisma.contact.findFirst({
        where: {
          tenantId,
          OR: [
            ...(isObjectId ? [{ id: contactId }] : []),
            { contactId },
            { phone: contactId },
          ],
        },
        select: { id: true, contactId: true },
      });
      if (targetContact) {
        where.contactId = targetContact.id;
      } else if (isObjectId) {
        where.contactId = contactId;
      } else {
        where.contactId = '000000000000000000000000';
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
          contact: {
            select: {
              id: true,
              contactId: true,
              firstName: true,
              lastName: true,
              phone: true,
              addresses: {
                select: {
                  id: true,
                  city: true,
                  state: true,
                  pincode: true,
                  isPrimary: true,
                },
              },
              relatedTo: {
                select: {
                  primaryContact: {
                    select: {
                      addresses: {
                        select: {
                          city: true,
                          isPrimary: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          plan:    { include: { company: { select: { name: true } } } },
          assignedEmployee: { include: { employeeProfile: { select: { firstName: true, lastName: true } } } },
          renewedFromPolicy: { select: { id: true, policyNumber: true } },
          payments: { orderBy: { dueDate: 'asc' } },
        },
        orderBy,
      }),
      this.prisma.policy.count({ where }),
    ]);

    const formattedData = data.map((p: any) => {
      const lc = this.computePolicyLifecycleStatus(p);
      const matchCity = (p.notes || '').match(/(?:Policy Zone(?: Location)? City|Policy City|Zone City|City):\s*([^\n\r]+)/i);
      const noteCity = matchCity && matchCity[1].trim() && matchCity[1].trim() !== 'N/A' ? matchCity[1].trim() : undefined;
      const contactAddresses = p.contact?.addresses || [];
      const primaryAddress = contactAddresses.find((a: any) => a.isPrimary) || contactAddresses[0];
      let resolvedCity = noteCity || (primaryAddress?.city && primaryAddress.city !== 'N/A' ? primaryAddress.city : undefined);
      if (!resolvedCity) {
        const relPrimary = p.contact?.relatedTo?.[0]?.primaryContact;
        const relAddr = relPrimary?.addresses?.find((a: any) => a.isPrimary) || relPrimary?.addresses?.[0];
        if (relAddr?.city && relAddr.city !== 'N/A') {
          resolvedCity = relAddr.city;
        }
      }
      return {
        ...p,
        lifecycleStatus: lc.statusKey,
        displayStatus: lc.displayStatus,
        contactCity: resolvedCity || undefined,
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
      take: 200,
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
    let {
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
          OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
          status: { notIn: ['CANCELLED' as any] },
        },
      });

      if (existingRenewal && (!exists || exists.id !== existingRenewal.id)) {
        throw new ConflictException(`An active renewal policy (${existingRenewal.policyNumber}) already exists for previous policy #${prevPolicy.policyNumber}`);
      }

      renewedFromPolicyId = prevPolicy.id;
      isRenewalCase = true;
    }

    if (contactId && !notes?.match(/(?:Policy Zone(?: Location)? City|Policy City|Zone City|City):/i)) {
      try {
        const contactAddr = await this.prisma.address.findFirst({
          where: { contactId, isPrimary: true },
        }) || await this.prisma.address.findFirst({
          where: { contactId },
        });
        if (contactAddr?.city && contactAddr.city !== 'N/A') {
          notes = (notes ? `${notes}\n` : '') + `Policy Zone City: ${contactAddr.city}\nPolicy Zone Location City: ${contactAddr.city}`;
        }
      } catch (err: any) {
        this.logger.warn(`Failed to auto-resolve city for contact ${contactId}: ${err?.message}`);
      }
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
      deletedAt: null,
      assignedEmployeeId: assignedEmployeeId || null,
      businessType: (dto as any).businessType || (isRenewalCase ? 'RENEWAL' : 'FRESH'),
      ...(renewedFromPolicyId ? { renewedFromPolicyId } : {}),
      ...(maturityDate ? { maturityDate: new Date(maturityDate) } : {}),
      ...(nextDueDate ? { nextDueDate: new Date(nextDueDate) } : {}),
      ...(agentCode ? { agentCode } : {}),
      ...(notes ? { notes } : {}),
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
    await this.leadsService.autoCreateRenewalLeads(tenantId).catch(e => this.logger.warn(`Auto-renewal lead error: ${e.message}`));

    return { data: policy, message: 'Policy created successfully' };
  }

  async update(tenantId: string, id: string, dto: UpdatePolicyDto, userId: string, role?: UserRole) {
    const policy = await this.prisma.policy.findFirst({ where: { id, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    if (role === UserRole.EMPLOYEE && policy.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const fieldLabels: Record<string, string> = {
      policyNumber: 'Policy Number',
      contactId: 'Contact',
      planId: 'Plan',
      premiumAmount: 'Premium Amount',
      sumAssured: 'Sum Assured',
      status: 'Policy Status',
      startDate: 'Start Date',
      endDate: 'End Date',
      maturityDate: 'Maturity Date',
      paymentFrequency: 'Payment Frequency',
      nextDueDate: 'Next Due Date',
      insuredPerson: 'Insured Person',
      agentCode: 'Agent Code',
      notes: 'Notes',
      phcRequired: 'PHC Status',
      phcAmount: 'PHC Amount',
      assignedEmployeeId: 'Assigned Employee',
      businessType: 'Business Type',
      renewedFromPolicyId: 'Renewed From Policy',
    };
    const changedFields: string[] = [];
    for (const key of Object.keys(dto)) {
      if (!(key in fieldLabels)) continue;
      let oldValue = (policy as any)[key];
      let newValue = (dto as any)[key];
      if (!activityValuesDiffer(key, oldValue, newValue)) continue;

      if (key === 'assignedEmployeeId') {
        const empIds = [oldValue, newValue].filter(Boolean);
        if (empIds.length > 0) {
          const profiles = await this.prisma.employeeProfile.findMany({
            where: { OR: [{ id: { in: empIds } }, { userId: { in: empIds } }] },
            select: { id: true, userId: true, firstName: true, lastName: true },
          });
          const resolveName = (id?: string) => {
            if (!id) return null;
            const p = profiles.find(prof => prof.id === id || prof.userId === id);
            return p ? `${p.firstName} ${p.lastName}`.trim() : id;
          };
          oldValue = resolveName(oldValue);
          newValue = resolveName(newValue);
        }
      }

      const formatted = formatActivityChange(key, fieldLabels[key], oldValue, newValue);
      if (formatted) changedFields.push(formatted);
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
    if (changedFields.length > 0) {
      await this.logActivity(
        tenantId,
        userId,
        updated.contactId,
        id,
        'UPDATE',
        `Policy details updated: ${changedFields.join('; ')}`,
      );
    }
    // Sync preventive health checkup if present in notes
    if (updated.notes && (updated.notes.includes('Preventive Health Checkup:') || updated.notes.includes('PHC '))) {
      try {
        const notes = updated.notes;
        const amtMatch = notes.match(/PHC Utilized Amount:\s*₹?([\d,.]+)/i) || notes.match(/Preventive Health Checkup:[^\n]*?Utilized(?:\s*Amount)?:\s*₹?([\d,.]+)/i);
        const stMatch = notes.match(/(?:Preventive Health Checkup:[^\n]*?Status:\s*|PHC Status:\s*)([^,\n)]+)/i);
        const phcAmountMatch = notes.match(/Preventive Health Checkup:[^\n]*?Amount:\s*₹?([\d,.]+)/i);
        const fullPhcAmount = phcAmountMatch ? Number(phcAmountMatch[1].replace(/,/g, '')) : 0;

        let utilized = amtMatch ? Number(amtMatch[1].replace(/,/g, '')) : 0;
        const statusStr = stMatch ? stMatch[1].trim().toUpperCase() : '';
        if (!utilized && (statusStr === 'FULLY_UTILISED' || statusStr === 'FULLY UTILIZED') && fullPhcAmount > 0) {
          utilized = fullPhcAmount;
        }

        const bookingDateStr = notes.match(/PHC Booking Date:\s*([^\n]+)/i)?.[1]?.trim();
        const apptDateStr = notes.match(/PHC Appointment Date:\s*([^\n]+)/i)?.[1]?.trim();
        const centreName = notes.match(/PHC Centre(?:\s*\/\s*Lab Name)?:\s*([^\n]+)/i)?.[1]?.trim() || null;
        const centreCity = notes.match(/PHC Centre(?:\s*City|\s*\/\s*Lab City)?:\s*([^\n]+)/i)?.[1]?.trim() || null;
        const reimbursementType = notes.match(/PHC Reimbursement(?:\s*Type|\s*\/\s*Cashless)?:\s*([^\n]+)/i)?.[1]?.trim() || 'Cashless';

        const parseDateSafe = (dStr?: string | null) => {
          if (!dStr || dStr.toLowerCase() === 'n/a') return null;
          const dmy = dStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
          if (dmy) {
            const d = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
            if (!isNaN(d.getTime())) return d;
          }
          const d = new Date(dStr);
          return isNaN(d.getTime()) ? null : d;
        };

        const existingCheckup = await this.prisma.preventiveHealthCheckup.findFirst({
          where: { policyId: id },
        });

        const checkupStatus = statusStr === 'FULLY_UTILISED' ? 'Test Completed' : (apptDateStr ? 'Appointment Scheduled' : 'Test Booked');

        if (existingCheckup) {
          await this.prisma.preventiveHealthCheckup.update({
            where: { id: existingCheckup.id },
            data: {
              status: checkupStatus,
              utilizedAmount: utilized,
              bookingDate: parseDateSafe(bookingDateStr) || existingCheckup.bookingDate,
              scheduledAt: parseDateSafe(apptDateStr) || existingCheckup.scheduledAt,
              completedAt: statusStr === 'FULLY_UTILISED' ? (parseDateSafe(apptDateStr) || new Date()) : null,
              centreName,
              centreCity,
              reimbursementType,
            },
          });
        } else if (utilized > 0 || bookingDateStr || apptDateStr || centreName) {
          await this.prisma.preventiveHealthCheckup.create({
            data: {
              policyId: id,
              status: checkupStatus,
              utilizedAmount: utilized,
              bookingDate: parseDateSafe(bookingDateStr),
              scheduledAt: parseDateSafe(apptDateStr),
              completedAt: statusStr === 'FULLY_UTILISED' ? (parseDateSafe(apptDateStr) || new Date()) : null,
              centreName,
              centreCity,
              reimbursementType,
            },
          });
        }
      } catch (syncErr: any) {
        this.logger.warn(`Failed to sync preventiveHealthCheckup for policy ${id}: ${syncErr.message}`);
      }
    }

    // Auto-create renewal leads immediately for expiring policies
    await this.leadsService.autoCreateRenewalLeads(tenantId).catch(e => this.logger.warn(`Auto-renewal lead error: ${e.message}`));

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
    await this.logActivity(tenantId, userId, policy.contactId, policy.id, 'CREATE', `Insured member added: ${dto.name} (${dto.relationship})`);
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

    // Find earliest unpaid payment on this policy to mark as paid
    const existingUnpaid = await this.prisma.policyPayment.findFirst({
      where: { policyId, isPaid: false },
      orderBy: { dueDate: 'asc' },
    });

    let payment;
    if (existingUnpaid) {
      payment = await this.prisma.policyPayment.update({
        where: { id: existingUnpaid.id },
        data: {
          isPaid: true,
          paidDate: dto.paidDate ? new Date(dto.paidDate) : new Date(),
          amount: dto.amount && dto.amount > 0 ? dto.amount : existingUnpaid.amount,
          mode: (dto.mode || existingUnpaid.mode || 'ONLINE') as any,
          referenceNo: dto.referenceNo || existingUnpaid.referenceNo,
        },
      });
    } else {
      payment = await this.prisma.policyPayment.create({
        data: { ...dto, dueDate: effectiveDueDate, policyId } as any,
      });
    }

    // Compute next due date
    if (dto.isPaid) {
      const remainingUnpaid = await this.prisma.policyPayment.findFirst({
        where: { policyId, isPaid: false },
        orderBy: { dueDate: 'asc' },
      });
      const nextDue = remainingUnpaid ? remainingUnpaid.dueDate : policy.endDate;
      await this.prisma.policy.update({ where: { id: policyId }, data: { nextDueDate: nextDue } });
    }

    await this.logActivity(
      tenantId,
      userId,
      policy.contactId,
      policy.id,
      'CREATE',
      `Policy payment recorded: ₹${Number(dto.amount || 0).toLocaleString('en-IN')}`,
    );
    return { data: payment, message: 'Payment recorded' };
  }

  async markAllPaymentsPaid(tenantId: string, policyId: string, userId?: string, role?: UserRole) {
    const policy = await this.prisma.policy.findFirst({ where: { id: policyId, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    if (role === UserRole.EMPLOYEE && policy.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.policyPayment.updateMany({
      where: { policyId, isPaid: false },
      data: { isPaid: true, paidDate: new Date() },
    });

    const totalPayments = await this.prisma.policyPayment.count({ where: { policyId } });
    if (totalPayments === 0) {
      await this.prisma.policyPayment.create({
        data: {
          policyId,
          amount: policy.premiumAmount,
          dueDate: policy.startDate,
          isPaid: true,
          paidDate: new Date(),
        },
      });
    }

    await this.prisma.policy.update({
      where: { id: policyId },
      data: { nextDueDate: policy.endDate },
    });

    await this.logActivity(
      tenantId,
      userId,
      policy.contactId,
      policy.id,
      'UPDATE',
      'All installment payments marked as paid',
    );
    return { message: 'All installments marked as paid' };
  }

  // ── Nominees ──────────────────────────────────────────────────────────────

  async removeMember(tenantId: string, policyId: string, memberId: string) {
    const policy = await this.prisma.policy.findFirst({ where: { id: policyId, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    const member = await this.prisma.policyMember.findFirst({ where: { id: memberId, policyId } });
    await this.prisma.policyMember.deleteMany({ where: { id: memberId, policyId } });
    if (member) {
      await this.logActivity(tenantId, undefined, policy.contactId, policy.id, 'DELETE', `Insured member removed: ${member.name} (${member.relationship})`);
    }
    return { data: null, message: 'Member removed' };
  }

  async addNominee(tenantId: string, policyId: string, dto: CreateNomineeDto, userId?: string, role?: UserRole) {
    const policy = await this.prisma.policy.findFirst({ where: { id: policyId, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    if (role === UserRole.EMPLOYEE && policy.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    const nominee = await this.prisma.policyNominee.create({ data: { ...dto, policyId } });
    await this.logActivity(tenantId, userId, policy.contactId, policy.id, 'CREATE', `Nominee added: ${dto.name}`);
    return { data: nominee, message: 'Nominee added' };
  }

  async removeNominee(tenantId: string, policyId: string, nomineeId: string) {
    const policy = await this.prisma.policy.findFirst({ where: { id: policyId, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    const nominee = await this.prisma.policyNominee.findFirst({ where: { id: nomineeId, policyId } });
    await this.prisma.policyNominee.deleteMany({ where: { id: nomineeId, policyId } });
    if (nominee) {
      await this.logActivity(tenantId, undefined, policy.contactId, policy.id, 'DELETE', `Nominee removed: ${nominee.name} (${nominee.relationship})`);
    }
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
        OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
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

  // ── PHC Tracking ─────────────────────────────────────────────────────────

  async getPhcTracking(tenantId: string) {
    const policies = await this.prisma.policy.findMany({
      where: {
        tenantId,
        status: { notIn: ['INACTIVE_OLD' as any, 'CANCELLED', 'SURRENDERED'] },
        OR: [
          { plan: { hasPhcBenefit: true } },
          { plan: { category: { equals: 'HEALTH', mode: 'insensitive' } } },
          { notes: { contains: 'Preventive Health Checkup:' } },
          { healthCheckups: { some: {} } },
        ],
      },
      select: {
        id: true,
        policyNumber: true,
        startDate: true,
        endDate: true,
        sumAssured: true,
        businessType: true,
        notes: true,
        plan: {
          select: {
            id: true,
            name: true,
            category: true,
            hasPhcBenefit: true,
            phcAmount: true,
            phcCount: true,
            company: {
              select: {
                id: true,
                name: true,
                shortCode: true,
              },
            },
          },
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            leadStatus: true,
          },
        },
        healthCheckups: {
          select: {
            id: true,
            status: true,
            bookingDate: true,
            scheduledAt: true,
            completedAt: true,
            createdAt: true,
            centreName: true,
            centreCity: true,
            utilizedAmount: true,
            reimbursementType: true,
            member: {
              select: {
                id: true,
                name: true,
                relationship: true,
              },
            },
          },
        },
      },
    } as any);

    const now = new Date();

    const results = policies.map((p: any) => {
      const companyInfo = p.plan?.company;
      const tY = (p.endDate.getTime() - p.startDate.getTime()) / (1000 * 3600 * 24 * 365.25);
      const totalYears = Math.max(1, Math.ceil(tY));
      const notesPhcAmount = p.notes?.match(/(?:Preventive Health Checkup:[^\n]*?Amount:\s*|PHC Amount:\s*)₹?([\d,.]+)/i)?.[1];
      const baseEligibleAmount = (notesPhcAmount ? Number(notesPhcAmount.replace(/,/g, '')) : undefined)
        ?? (p.plan as any)?.phcAmount
        ?? 10000;
      const basePhcCount = (p.plan as any)?.phcCount || 1;

      // Extract notes utilized amount
      const notesUtilizedMatch = p.notes?.match(/PHC Utilized Amount:\s*₹?([\d,.]+)/i)
        || p.notes?.match(/Utilized(?:\s*Amount)?:\s*₹?([\d,.]+)/i);
      let notesUtilized = notesUtilizedMatch ? Number(notesUtilizedMatch[1].replace(/,/g, '')) : 0;

      // Check explicit PHC status from policy notes or contact
      let explicitStatus: string | null = null;
      const notesStatusMatch = p.notes?.match(/(?:Preventive Health Checkup:[^\n]*?Status:\s*|PHC Status:\s*)([^,\n)]+)/i)?.[1]?.trim();
      if (notesStatusMatch) {
        const u = notesStatusMatch.toUpperCase();
        if (u === 'INTERESTED' || u === 'HOT' || u === 'VERY_HOT') explicitStatus = 'Interested';
        else if (u === 'NOT_INTERESTED' || u === 'LEAD_LOST') explicitStatus = 'Not Interested';
        else if (u === 'FULLY_UTILISED' || u === 'FULLY UTILISED' || u === 'FULLY UTILIZED') explicitStatus = 'Fully Utilized';
        else if (u === 'PARTIAL_UTILISED' || u === 'PARTIAL UTILISED' || u === 'PARTIAL UTILIZED') explicitStatus = 'Partial Utilized';
        else if (u === 'COMPLETED') explicitStatus = 'Completed';
        else if (u === 'REMIND_LATER' || u === 'PENDING') explicitStatus = 'Upcoming';
      }

      if (notesUtilized === 0 && (explicitStatus === 'Fully Utilized' || notesStatusMatch?.toUpperCase() === 'FULLY_UTILISED')) {
        notesUtilized = baseEligibleAmount;
      }

      if (!explicitStatus && p.contact) {
        const cls = p.contact.leadStatus?.trim();
        if (cls) {
          const u = cls.toUpperCase();
          if (u === 'INTERESTED' || u === 'HOT' || u === 'VERY_HOT') explicitStatus = 'Interested';
          else if (u === 'NOT_INTERESTED' || u === 'LEAD_LOST') explicitStatus = 'Not Interested';
        }
      }
      
      const years: any[] = [];
      let totalUtilized = 0;
      let totalEligible = 0;
      
      let p_phcStatus = explicitStatus || 'Upcoming';
      let currentPhcYearLabel = 'Year 1 (Current)';
      let p_daysRemaining = 0;
      let p_phcYearStartDate = p.startDate;
      let p_phcYearEndDate = p.endDate;
      let p_eligibleAmount = 0;
      let p_utilizedAmount = 0;
      let p_balanceAmount = 0;

      for (let i = 0; i < totalYears; i++) {
        const yearStart = new Date(p.startDate);
        yearStart.setFullYear(yearStart.getFullYear() + i);
        const yearEnd = new Date(yearStart);
        yearEnd.setFullYear(yearEnd.getFullYear() + 1);
        yearEnd.setDate(yearEnd.getDate() - 1);
        
        const actualEnd = yearEnd > p.endDate ? p.endDate : yearEnd;
        
        const yearCheckups = (p as any).healthCheckups.filter((h: any) => {
          const checkupDate = h.completedAt || h.scheduledAt || h.bookingDate || h.createdAt;
          return checkupDate >= yearStart && checkupDate <= actualEnd;
        });
        const checkupsUtilized = yearCheckups.reduce((sum: number, h: any) => sum + (h.utilizedAmount || 0), 0);
        const isCurrent = now >= yearStart && now <= actualEnd;
        const yearUtilized = checkupsUtilized > 0 ? checkupsUtilized : (isCurrent || (totalYears === 1 && i === 0) ? notesUtilized : 0);

        if (yearCheckups.length === 0 && (yearUtilized > 0 || explicitStatus === 'Fully Utilized' || explicitStatus === 'Partial Utilized')) {
          const notesBookingDate = p.notes?.match(/PHC Booking Date:\s*([^\n]+)/i)?.[1]?.trim();
          const notesAppointmentDate = p.notes?.match(/PHC Appointment Date:\s*([^\n]+)/i)?.[1]?.trim();
          const notesCentreName = p.notes?.match(/PHC Centre(?:\s*\/\s*Lab Name)?:\s*([^\n]+)/i)?.[1]?.trim();
          const notesCentreCity = p.notes?.match(/PHC Centre(?:\s*City|\s*\/\s*Lab City)?:\s*([^\n]+)/i)?.[1]?.trim();
          const notesReimbursement = p.notes?.match(/PHC Reimbursement(?:\s*Type|\s*\/\s*Cashless)?:\s*([^\n]+)/i)?.[1]?.trim();
          const notesPerson = p.notes?.match(/(?:PHC Insured Person:\s*|Insured Person for PHC:\s*|Insured Person:\s*)([^\n]+)/i)?.[1]?.trim()
            || (p.contact ? `${p.contact.firstName} ${p.contact.lastName || ''}`.trim() : 'Primary');

          const parseDateSafe = (dStr?: string | null) => {
            if (!dStr || dStr.toLowerCase() === 'n/a') return null;
            const dmy = dStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
            if (dmy) {
              const d = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
              if (!isNaN(d.getTime())) return d;
            }
            const d = new Date(dStr);
            return isNaN(d.getTime()) ? null : d;
          };

          yearCheckups.push({
            id: `notes-${p.id}`,
            status: explicitStatus === 'Fully Utilized' ? 'Test Completed' : (notesAppointmentDate ? 'Appointment Scheduled' : (notesBookingDate ? 'Test Booked' : 'Completed')),
            bookingDate: parseDateSafe(notesBookingDate),
            scheduledAt: parseDateSafe(notesAppointmentDate),
            completedAt: explicitStatus === 'Fully Utilized' ? (parseDateSafe(notesAppointmentDate) || now) : null,
            createdAt: p.createdAt,
            centreName: notesCentreName || null,
            centreCity: notesCentreCity || null,
            utilizedAmount: yearUtilized,
            reimbursementType: notesReimbursement || 'Cashless',
            member: {
              id: null,
              name: notesPerson,
              relationship: 'Self',
            }
          });
        }
        
        const eligibleAmount = baseEligibleAmount;
        const balanceAmount = Math.max(0, eligibleAmount - yearUtilized);
        
        totalUtilized += yearUtilized;
        totalEligible += eligibleAmount;
        
        let statusStr = 'Upcoming';
        if (yearUtilized >= eligibleAmount && eligibleAmount > 0) {
          statusStr = 'Fully Utilized';
        } else if (yearUtilized > 0) {
          statusStr = 'Partial Utilized';
        } else if (explicitStatus && explicitStatus !== 'Not Applicable Yet') {
          statusStr = explicitStatus;
        } else if (now > actualEnd) {
          statusStr = 'Overdue';
        } else {
          const isDueThisMonth = actualEnd.getFullYear() === now.getFullYear() && actualEnd.getMonth() === now.getMonth();
          statusStr = isDueThisMonth ? 'Due This Month' : 'Upcoming';
        }
        
        const personMap = new Map();
        for (const c of yearCheckups) {
           const personName = c.member ? `${c.member.name} (${c.member.relationship})` : (p.contact ? `${p.contact.firstName} (Self)` : 'Primary');
           if (!personMap.has(personName)) personMap.set(personName, { name: personName, relationship: c.member?.relationship || 'Self', utilizedAmount: 0, phcCount: 0 });
           const entry = personMap.get(personName);
           entry.utilizedAmount += (c.utilizedAmount || 0);
           entry.phcCount += 1;
        }

        if (personMap.size === 0 && yearUtilized > 0) {
          const notesPerson = p.notes?.match(/(?:PHC Insured Person:\s*|Insured Person for PHC:\s*|Insured Person:\s*)([^\n]+)/i)?.[1]?.trim()
            || (p.contact ? `${p.contact.firstName} ${p.contact.lastName || ''}`.trim() : 'Primary');
          personMap.set(notesPerson, {
            name: notesPerson,
            relationship: 'Self',
            utilizedAmount: yearUtilized,
            phcCount: 1,
          });
        }

        const yrData = {
          yearNo: i + 1,
          label: `Year ${i + 1}`,
          isCurrent,
          startDate: yearStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          endDate: actualEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          status: statusStr,
          eligibleAmount,
          utilizedAmount: yearUtilized,
          balanceAmount,
          phcCount: yearCheckups.length || (yearUtilized > 0 ? 1 : 0),
          daysRemaining: isCurrent ? Math.max(0, Math.ceil((actualEnd.getTime() - now.getTime()) / (1000 * 3600 * 24))) : 0,
          insuredPersons: Array.from(personMap.values()),
          allCheckups: yearCheckups
        };
        
        if (isCurrent) {
          currentPhcYearLabel = `Year ${i + 1} (Current)`;
          p_phcStatus = yrData.status;
          p_daysRemaining = yrData.daysRemaining;
          p_phcYearStartDate = yearStart;
          p_phcYearEndDate = actualEnd;
          p_eligibleAmount = yrData.eligibleAmount;
          p_utilizedAmount = yrData.utilizedAmount;
          p_balanceAmount = yrData.balanceAmount;
        }
        
        years.push(yrData);
      }

      if (!years.some(y => y.isCurrent) && years.length > 0) {
        const fallbackYear = now > p.endDate ? years[years.length - 1] : years[0];
        currentPhcYearLabel = fallbackYear.label;
        p_phcStatus = fallbackYear.status;
        p_daysRemaining = fallbackYear.daysRemaining;
        p_phcYearStartDate = p.startDate;
        p_phcYearEndDate = p.endDate;
        p_eligibleAmount = fallbackYear.eligibleAmount;
        p_utilizedAmount = fallbackYear.utilizedAmount;
        p_balanceAmount = fallbackYear.balanceAmount;
      }
      
      const companyColors = ['bg-blue-600', 'bg-red-600', 'bg-teal-600', 'bg-orange-500', 'bg-purple-600'];
      const cColor = companyColors[companyInfo?.name?.length ? companyInfo.name.length % companyColors.length : 0] || 'bg-blue-600';

      return {
        id: p.id,
        policyNo: p.policyNumber,
        customerName: p.contact ? `${p.contact.firstName} ${p.contact.lastName || ''}`.trim() : 'Unknown',
        customerPhone: p.contact?.phone || '',
        planName: (p.plan as any)?.name || '',
        companyInitials: companyInfo?.shortCode || (companyInfo?.name ? companyInfo.name.substring(0,4).toUpperCase() : ''),
        companyName: companyInfo?.name || '',
        companyType: (p.plan as any)?.category || 'Health',
        companyColor: cColor, 
        policyStartDate: p.startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        policyEndDate: p.endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        rawPolicyStartDate: p.startDate,
        rawPolicyEndDate: p.endDate,
        sumInsured: p.sumAssured || 0,
        phcFrequency: 'Annual',
        currentPhcYear: currentPhcYearLabel,
        phcYearStartDate: p_phcYearStartDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        phcYearEndDate: p_phcYearEndDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        rawPhcYearStartDate: p_phcYearStartDate,
        rawPhcYearEndDate: p_phcYearEndDate,
        phcStatus: p_phcStatus,
        phcCount: basePhcCount,
        eligibleAmount: p_eligibleAmount !== undefined ? p_eligibleAmount : totalEligible,
        utilizedAmount: p_utilizedAmount !== undefined ? p_utilizedAmount : totalUtilized,
        balanceAmount: p_balanceAmount !== undefined ? p_balanceAmount : Math.max(0, totalEligible - totalUtilized),
        daysRemaining: p_daysRemaining,
        totalYears,
        years,
        allCheckups: years.flatMap(year => year.allCheckups),
      };
    });

    return { data: results };
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
    tenantId: string, userId: string | undefined, contactId: string,
    entityId: string, action: string, description: string,
  ) {
    try {
      await this.prisma.activityLog.create({
        data: { tenantId, ...(userId ? { userId } : {}), contactId, entityType: 'Policy', entityId, action, description },
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
      for (const member of dto.members || []) {
        await this.logActivity(
          tenantId,
          createdById,
          result.contactId,
          result.id,
          'CREATE',
          `Insured member added: ${member.name} (${member.relationship})`,
        );
      }
      for (const nominee of dto.nominees || []) {
        await this.logActivity(
          tenantId,
          createdById,
          result.contactId,
          result.id,
          'CREATE',
          `Nominee added: ${nominee.name} (${nominee.relationship})`,
        );
      }
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
            deletedAt: null,
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
