// ─────────────────────────────────────────────────────────────────────────────
// Leads Service — manages product interests / sales pipeline
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateLeadDto, UpdateLeadDto, MoveLeadStageDto,
  LeadQueryDto, AddConsultationDto,
} from './dto/lead.dto';
import { LeadStage, UserRole } from '@prisma/client';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);
  constructor(private readonly prisma: PrismaService) {}

  // ── Kanban board — group leads by stage ──────────────────────────────────

  async getKanbanBoard(tenantId: string, userId: string, role: UserRole) {
    const where: any = { tenantId };

    // Employees only see their assigned leads
    if (role === UserRole.EMPLOYEE) {
      where.assignedEmployeeId = userId;
    }

    const leads = await this.prisma.productInterest.findMany({
      where,
      include: {
        contact:          { select: { id: true, firstName: true, lastName: true, phone: true } },
        plan:             { include: { company: { select: { name: true } } } },
        assignedEmployee: { include: { employeeProfile: { select: { firstName: true, lastName: true } } } },
        consultations:    { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Group stage → leads for the Kanban board
    const board: Record<LeadStage, typeof leads> = {
      OPEN:            [],
      CONTACTED:       [],
      PROPOSAL_SENT:   [],
      IN_DISCUSSION:   [],
      LOGIN_PROGRESS:  [],
      PAYMENT_DONE:    [],
      LOST:            [],
    };

    leads.forEach((lead) => {
      board[lead.stage].push(lead);
    });

    return { data: board };
  }

  // ── List leads ───────────────────────────────────────────────────────────

  async findAll(tenantId: string, userId: string, role: UserRole, query: LeadQueryDto) {
    const page  = Math.max(1, parseInt(String((query as any).page  ?? 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String((query as any).limit ?? 20), 10) || 20));
    const { stage, search, assignedEmployeeId, contactId, followUpDateFrom, followUpDateTo } = query as any;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (role === UserRole.EMPLOYEE) where.assignedEmployeeId = userId;
    if (stage)                      where.stage              = stage;
    if (assignedEmployeeId)         where.assignedEmployeeId = assignedEmployeeId;
    if (contactId)                  where.contactId          = contactId;
    if (followUpDateFrom || followUpDateTo) {
      where.followUpDate = {};
      if (followUpDateFrom) where.followUpDate.gte = new Date(followUpDateFrom);
      if (followUpDateTo)   where.followUpDate.lte = new Date(followUpDateTo);
    }
    if (search) {
      where.contact = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName:  { contains: search, mode: 'insensitive' } },
          { phone:     { contains: search } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.productInterest.findMany({
        where,
        skip,
        take:    limit,
        include: {
          contact: { select: { firstName: true, lastName: true, phone: true, tags: true } },
          plan:    { include: { company: { select: { name: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.productInterest.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ── Find one lead ────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string, userId: string, role: UserRole) {
    const lead = await this.prisma.productInterest.findFirst({
      where:   { id, tenantId },
      include: {
        contact:       true,
        plan:          { include: { company: true } },
        consultations: { orderBy: { createdAt: 'desc' } },
        assignedEmployee: {
          include: { employeeProfile: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!lead) throw new NotFoundException('Lead not found');

    // Employee can only view own assigned leads
    if (role === UserRole.EMPLOYEE && lead.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return { data: lead };
  }

  // ── Create lead ──────────────────────────────────────────────────────────

  async create(tenantId: string, dto: CreateLeadDto, createdById: string, role?: UserRole) {
    // When an employee creates a lead without explicitly naming an assignee,
    // auto-assign it to themselves so it immediately appears in their list view.
    const data: any = { ...dto, tenantId };
    if (role === UserRole.EMPLOYEE && !data.assignedEmployeeId) {
      data.assignedEmployeeId = createdById;
    }

    const lead = await this.prisma.productInterest.create({ data });

    // Log activity
    await this.logActivity(tenantId, createdById, lead.contactId, lead.id, 'CREATE', 'Lead created');

    // Auto-create follow-up calendar event
    if (dto.followUpDate) {
      await this.prisma.calendarEvent.create({
        data: {
          tenantId,
          contactId:  dto.contactId,
          title:      'Lead Follow-up',
          eventType:  'FOLLOWUP',
          startAt:    new Date(dto.followUpDate),
          isAutomatic: true,
          relatedId:  lead.id,
        },
      });
    }

    return { data: lead, message: 'Lead created successfully' };
  }

  // ── Update lead ──────────────────────────────────────────────────────────

  async update(tenantId: string, id: string, dto: UpdateLeadDto, userId: string, role?: UserRole) {
    const lead = await this.prisma.productInterest.findFirst({ where: { id, tenantId } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (role === UserRole.EMPLOYEE && lead.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.productInterest.update({
      where: { id },
      data:  dto as any,
    });

    await this.logActivity(tenantId, userId, updated.contactId, id, 'UPDATE', 'Lead updated');
    return { data: updated, message: 'Lead updated' };
  }

  // ── Move to next pipeline stage ──────────────────────────────────────────

  async moveStage(tenantId: string, id: string, dto: MoveLeadStageDto, userId: string, role?: UserRole) {
    const lead = await this.prisma.productInterest.findFirst({ where: { id, tenantId } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (role === UserRole.EMPLOYEE && lead.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.productInterest.update({
      where: { id },
      data:  {
        stage:      dto.stage,
        notes:      dto.notes ?? lead.notes,
        lostReason: dto.lostReason,
      },
    });

    await this.logActivity(
      tenantId, userId, updated.contactId, id,
      'STAGE_CHANGE',
      `Lead moved from ${lead.stage} → ${dto.stage}`,
    );

    return { data: updated, message: `Lead moved to ${dto.stage}` };
  }

  // ── Consultations ────────────────────────────────────────────────────────

  async addConsultation(tenantId: string, leadId: string, dto: AddConsultationDto, userId: string, role?: UserRole) {
    const lead = await this.prisma.productInterest.findFirst({ where: { id: leadId, tenantId } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (role === UserRole.EMPLOYEE && lead.assignedEmployeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const consultation = await this.prisma.productInterestConsultation.create({
      data: { productInterestId: leadId, ...dto },
    });

    await this.logActivity(tenantId, userId, lead.contactId, leadId, 'UPDATE', 'Consultation added');
    return { data: consultation, message: 'Consultation recorded' };
  }

  async remove(tenantId: string, id: string) {
    const lead = await this.prisma.productInterest.findFirst({ where: { id, tenantId } });
    if (!lead) throw new NotFoundException('Lead not found');
    await this.prisma.productInterest.delete({ where: { id } });
    return { data: null, message: 'Lead deleted' };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async logActivity(
    tenantId: string, userId: string, contactId: string,
    entityId: string, action: string, description: string,
  ) {
    try {
      await this.prisma.activityLog.create({
        data: { tenantId, userId, contactId, entityType: 'Lead', entityId, action, description },
      });
    } catch (err: any) {
      this.logger.warn(`ActivityLog write failed: ${err.message}`);
    }
  }

  async updateLeadAssignee(tenantId: string, id: string, assignedEmployeeId: string | null, userId: string) {
    const lead = await this.prisma.productInterest.findFirst({ where: { id, tenantId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const updated = await this.prisma.productInterest.update({
      where: { id },
      data: { assignedEmployeeId },
    });

    await this.logActivity(
      tenantId, userId, updated.contactId, id,
      'ASSIGNEE_CHANGE',
      `Lead assignee updated to ${assignedEmployeeId || 'unassigned'}`,
    );

    return { data: updated, message: 'Lead assignee updated successfully' };
  }

  async bulkAssignLeads(tenantId: string, ids: string[], assignedEmployeeId: string | null, userId: string) {
    const leads = await this.prisma.productInterest.findMany({
      where: { id: { in: ids }, tenantId },
      select: { id: true, contactId: true },
    });

    await this.prisma.productInterest.updateMany({
      where: { id: { in: ids }, tenantId },
      data: { assignedEmployeeId },
    });

    for (const lead of leads) {
      await this.logActivity(
        tenantId, userId, lead.contactId, lead.id,
        'ASSIGNEE_CHANGE',
        `Lead bulk reassigned to ${assignedEmployeeId || 'unassigned'}`,
      );
    }

    return { message: `${leads.length} leads successfully reassigned` };
  }

  async importLeads(
    tenantId: string,
    createdById: string,
    rows: Array<{
      contactPhone: string;
      contactFirstName: string;
      contactLastName?: string;
      planCode?: string;
      stage?: string;
      notes?: string;
    }>,
    role?: UserRole,
  ) {
    let created = 0;
    const skipped: string[] = [];

    for (const row of rows) {
      if (!row.contactPhone || !row.contactFirstName) {
        skipped.push(row.contactPhone || 'unknown');
        continue;
      }

      // Check or create contact
      let contact = await this.prisma.contact.findFirst({
        where: { tenantId, phone: row.contactPhone },
      });

      if (!contact) {
        try {
          contact = await this.prisma.contact.create({
            data: {
              tenantId,
              phone: row.contactPhone,
              firstName: row.contactFirstName,
              lastName: row.contactLastName || '',
            },
          });
        } catch (err: any) {
          this.logger.error(`Failed to create contact for lead import: ${err.message}`);
          skipped.push(`${row.contactPhone} (contact creation failed)`);
          continue;
        }
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
        skipped.push(`${row.contactPhone} (no active insurance plans available)`);
        continue;
      }

      try {
        await this.prisma.productInterest.create({
          data: {
            tenantId,
            contactId: contact.id,
            planId,
            stage: (row.stage || 'OPEN') as any,
            notes: row.notes || '',
            // Auto-assign to the importing employee so the lead appears in their list
            ...(role === UserRole.EMPLOYEE ? { assignedEmployeeId: createdById } : {}),
          },
        });
        created++;
      } catch (err: any) {
        this.logger.error(`Failed to import lead: ${err.message}`);
        skipped.push(row.contactPhone);
      }
    }

    return { created, skipped };
  }
}
