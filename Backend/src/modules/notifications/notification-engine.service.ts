// ─────────────────────────────────────────────────────────────────────────────
// NotificationEngineService
// Central hub for firing structured notifications.
// Consume this service from any feature module — never call prisma.notification
// directly from a service; go through these typed helpers instead.
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationEngineService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Policy / Premium ────────────────────────────────────────────────────────

  async notifyPolicyRenewal(
    tenantId:   string,
    policyId:   string,
    policyNumber: string,
    employeeId: string,
    daysLeft:   number,
  ) {
    return this.prisma.notification.create({
      data: {
        tenantId,
        userId: employeeId,
        type:   NotificationType.RENEWAL_REMINDER,
        title:  `Policy renewal in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        body:   `Policy #${policyNumber} is due for renewal in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        data:   { policyId, daysLeft },
      },
    });
  }

  async notifyPaymentDue(
    tenantId:   string,
    paymentId:  string,
    policyId:   string,
    policyNumber: string,
    employeeId: string,
    daysLeft:   number,
    amount:     number,
  ) {
    return this.prisma.notification.create({
      data: {
        tenantId,
        userId: employeeId,
        type:   NotificationType.PAYMENT_DUE,
        title:  `Premium due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        body:   `Premium of ₹${amount.toLocaleString('en-IN')} for policy #${policyNumber} is due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        data:   { paymentId, policyId, amount, daysLeft },
      },
    });
  }

  // ── Claims ──────────────────────────────────────────────────────────────────

  async notifyClaimAssigned(
    tenantId:           string,
    claimId:            string,
    claimNumber:        string,
    assignedEmployeeId: string,
  ) {
    return this.prisma.notification.create({
      data: {
        tenantId,
        userId: assignedEmployeeId,
        type:   NotificationType.CLAIM_UPDATE,
        title:  'New Claim Assigned',
        body:   `Claim #${claimNumber} has been assigned to you.`,
        data:   { claimId },
      },
    });
  }

  async notifyClaimUpdate(
    tenantId:           string,
    claimId:            string,
    claimNumber:        string,
    newStatus:          string,
    assignedEmployeeId: string,
  ) {
    return this.prisma.notification.create({
      data: {
        tenantId,
        userId: assignedEmployeeId,
        type:   NotificationType.CLAIM_UPDATE,
        title:  'Claim Status Updated',
        body:   `Claim #${claimNumber} status has changed to ${newStatus}.`,
        data:   { claimId, status: newStatus },
      },
    });
  }

  // ── Tasks ───────────────────────────────────────────────────────────────────

  async notifyTaskAssigned(
    tenantId:     string,
    assignedToId: string,
    taskId:       string,
    taskTitle:    string,
  ) {
    return this.prisma.notification.create({
      data: {
        tenantId,
        userId: assignedToId,
        type:   NotificationType.TASK_ASSIGNED,
        title:  'New Task Assigned',
        body:   `Task "${taskTitle}" has been assigned to you.`,
        data:   { taskId },
      },
    });
  }

  async notifyTaskReminder(
    tenantId:     string,
    assignedToId: string,
    taskId:       string,
    taskTitle:    string,
    dueDate:      Date,
  ) {
    const dueDateStr = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return this.prisma.notification.create({
      data: {
        tenantId,
        userId: assignedToId,
        type:   NotificationType.TASK_ASSIGNED,
        title:  'Task Reminder',
        body:   `Task "${taskTitle}" is due on ${dueDateStr}.`,
        data:   { taskId, dueDate: dueDate.toISOString() },
      },
    });
  }

  // ── Leads / Follow-ups ──────────────────────────────────────────────────────

  async notifyLeadFollowup(
    tenantId:           string,
    leadId:             string,
    contactName:        string,
    assignedEmployeeId: string,
  ) {
    return this.prisma.notification.create({
      data: {
        tenantId,
        userId: assignedEmployeeId,
        type:   NotificationType.LEAD_FOLLOWUP,
        title:  'Lead Follow-up Due',
        body:   `Follow-up with ${contactName} is due today.`,
        data:   { leadId },
      },
    });
  }

  // ── Birthdays ───────────────────────────────────────────────────────────────

  async notifyBirthday(
    tenantId:    string,
    contactId:   string,
    contactName: string,
    employeeId:  string,
  ) {
    return this.prisma.notification.create({
      data: {
        tenantId,
        userId: employeeId,
        type:   NotificationType.BIRTHDAY,
        title:  "Client Birthday Today",
        body:   `Today is ${contactName}'s birthday. Send them a greeting!`,
        data:   { contactId },
      },
    });
  }

  // ── Tenant Broadcast (system announcements) ─────────────────────────────────

  /**
   * Create one SYSTEM notification per active employee/owner in the tenant.
   * Useful for announcements, quota warnings, or scheduled reminders.
   */
  async broadcastToTenant(
    tenantId: string,
    title:    string,
    body:     string,
    meta?:    Record<string, unknown>,
  ) {
    const users = await this.prisma.user.findMany({
      where:  { tenantId, isActive: true },
      select: { id: true },
    });

    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        tenantId,
        userId: u.id,
        type:   NotificationType.SYSTEM,
        title,
        body,
        data:   (meta ?? {}) as any,
      })),
    });
  }

  // ── Utility ─────────────────────────────────────────────────────────────────

  async countUnread(tenantId: string, userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { tenantId, userId, isRead: false },
    });
  }
}
