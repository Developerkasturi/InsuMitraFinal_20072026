// ─────────────────────────────────────────────────────────────────────────────
// Calendar Service — events, auto-events from policies/leads/birthdays
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvents(tenantId: string, userId: string, role: UserRole, query: any) {
    const { startDate, endDate, eventType } = query;

    const where: any = { tenantId };
    if (startDate) where.startAt = { gte: new Date(startDate) };
    if (endDate)   where.startAt = { ...where.startAt, lte: new Date(endDate) };
    if (eventType) where.eventType = eventType;

    if (role === UserRole.EMPLOYEE) {
      where.OR = [
        { contactId: null },
        {
          contact: {
            policies: {
              some: { assignedEmployeeId: userId }
            }
          }
        },
        {
          contact: {
            productInterests: {
              some: { assignedEmployeeId: userId }
            }
          }
        },
        {
          contact: {
            claims: {
              some: { assignedEmployeeId: userId }
            }
          }
        }
      ];
    }

    const events = await this.prisma.calendarEvent.findMany({
      where,
      include: { contact: { select: { firstName: true, lastName: true, phone: true } } },
      orderBy: { startAt: 'asc' },
    });

    return { data: events };
  }

  async createEvent(tenantId: string, dto: any) {
    const event = await this.prisma.calendarEvent.create({
      data: { ...dto, tenantId },
    });
    return { data: event, message: 'Event created' };
  }

  async updateEvent(tenantId: string, id: string, dto: any) {
    await this.prisma.calendarEvent.updateMany({ where: { id, tenantId }, data: dto });
    return { data: null, message: 'Event updated' };
  }

  async deleteEvent(tenantId: string, id: string) {
    await this.prisma.calendarEvent.deleteMany({ where: { id, tenantId } });
    return { data: null, message: 'Event deleted' };
  }

  /** Upcoming events for the next 7 days — used in dashboard widgets */
  async getUpcoming(tenantId: string, days = 7) {
    const now    = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return this.prisma.calendarEvent.findMany({
      where:   { tenantId, startAt: { gte: now, lte: cutoff } },
      include: { contact: { select: { firstName: true, lastName: true } } },
      orderBy: { startAt: 'asc' },
      take:    20,
    });
  }
}
