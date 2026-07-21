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
    if (endDate) {
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      where.startAt = { ...where.startAt, lte: end };
    }
    if (eventType) where.eventType = eventType;

    if (role === UserRole.EMPLOYEE) {
      const allowedContacts = await this.prisma.contact.findMany({
        where: {
          tenantId,
          OR: [
            { assignedEmployeeId: userId },
            { policies: { some: { assignedEmployeeId: userId } } },
            { productInterests: { some: { assignedEmployeeId: userId } } },
            { claims: { some: { assignedEmployeeId: userId } } }
          ]
        },
        select: { id: true }
      });
      const allowedContactIds = allowedContacts.map(c => c.id);

      where.OR = [
        { contactId: null },
        { contactId: { isSet: false } },
        { contactId: { in: allowedContactIds } }
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
  async getUpcoming(tenantId: string, days = 7, userId?: string, role?: UserRole) {
    const now    = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const where: any = { tenantId, startAt: { gte: now, lte: cutoff } };

    if (role === UserRole.EMPLOYEE && userId) {
      const allowedContacts = await this.prisma.contact.findMany({
        where: {
          tenantId,
          OR: [
            { assignedEmployeeId: userId },
            { policies: { some: { assignedEmployeeId: userId } } },
            { productInterests: { some: { assignedEmployeeId: userId } } },
            { claims: { some: { assignedEmployeeId: userId } } }
          ]
        },
        select: { id: true }
      });
      const allowedContactIds = allowedContacts.map(c => c.id);

      where.OR = [
        { contactId: null },
        { contactId: { isSet: false } },
        { contactId: { in: allowedContactIds } }
      ];
    }

    return this.prisma.calendarEvent.findMany({
      where,
      include: { contact: { select: { firstName: true, lastName: true } } },
      orderBy: { startAt: 'asc' },
      take:    20,
    });
  }
}
