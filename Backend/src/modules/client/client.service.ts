// ─────────────────────────────────────────────────────────────────────────────
// Client Service — read-only portal data for CONTACT-role users
// All methods scope data to the logged-in contact via userId → contactId
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ClientService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Resolve contact from userId ───────────────────────────────────────────

  private async resolveContact(userId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { userId },
    });
    if (!contact) throw new NotFoundException('Client profile not found');
    return contact;
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const contact = await this.prisma.contact.findFirst({
      where:   { userId },
      include: {
        addresses:  true,
        occupations: true,
        tenant: {
          select: {
            name:     true,
            logoUrl:  true,
            phone:    true,
            email:    true,
            website:  true,
          },
        },
      },
    });
    if (!contact) throw new NotFoundException('Client profile not found');
    return { data: contact };
  }

  async updateProfile(userId: string, dto: { phone?: string; email?: string; notes?: string }) {
    const contact = await this.resolveContact(userId);
    const updated = await this.prisma.contact.update({
      where: { id: contact.id },
      data:  dto,
    });
    return { data: updated, message: 'Profile updated' };
  }

  // ── Policies ──────────────────────────────────────────────────────────────

  async getPolicies(userId: string) {
    const contact = await this.resolveContact(userId);
    const policies = await this.prisma.policy.findMany({
      where:   { contactId: contact.id, deletedAt: null },
      include: {
        plan: {
          include: { company: { select: { name: true, logoUrl: true } } },
        },
        nominees: true,
        members:  true,
      },
      orderBy: { endDate: 'asc' },
    });
    return { data: policies };
  }

  async getPolicyDetail(userId: string, policyId: string) {
    const contact = await this.resolveContact(userId);
    const policy = await this.prisma.policy.findFirst({
      where:   { id: policyId, contactId: contact.id },
      include: {
        plan: {
          include: { company: true },
        },
        nominees: true,
        members:  true,
        payments: { orderBy: { dueDate: 'desc' }, take: 12 },
        claims:   { select: { id: true, claimNumber: true, status: true, claimAmount: true, intimatedAt: true } },
      },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    return { data: policy };
  }

  // ── Claims ────────────────────────────────────────────────────────────────

  async getClaims(userId: string) {
    const contact = await this.resolveContact(userId);
    const claims = await this.prisma.claim.findMany({
      where:   { contactId: contact.id, deletedAt: null },
      include: {
        policy: { select: { policyNumber: true, plan: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: claims };
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  async getDocuments(userId: string) {
    const contact = await this.resolveContact(userId);
    const documents = await this.prisma.document.findMany({
      where:   { contactId: contact.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return { data: documents };
  }
}
