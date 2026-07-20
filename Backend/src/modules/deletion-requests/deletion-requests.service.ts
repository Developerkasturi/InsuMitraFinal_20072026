import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DeletionRequestsService {
  constructor(private prisma: PrismaService) {}

  async createRequest(tenantId: string, userId: string, entityType: string, entityId: string, reason?: string) {
    return this.prisma.deletionRequest.create({
      data: {
        tenantId,
        requestedBy: userId,
        entityType,
        entityId,
        reason,
        status: 'PENDING',
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.deletionRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveRequest(tenantId: string, requestId: string, adminId: string, action: 'APPROVED' | 'REJECTED') {
    const request = await this.prisma.deletionRequest.findFirst({
      where: { id: requestId, tenantId },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== 'PENDING') {
      throw new ForbiddenException('Request already resolved');
    }

    // Update status
    const updated = await this.prisma.deletionRequest.update({
      where: { id: requestId },
      data: {
        status: action,
        resolvedBy: adminId,
        resolvedAt: new Date(),
      },
    });

    // If APPROVED, actually delete the entity (this requires knowing the entity type)
    if (action === 'APPROVED') {
      await this.executeDeletion(tenantId, request.entityType, request.entityId);
    }

    return updated;
  }

  private async executeDeletion(tenantId: string, entityType: string, entityId: string) {
    switch (entityType) {
      case 'Contact':
        await this.prisma.contact.update({ where: { id: entityId }, data: { deletedAt: new Date(), isActive: false } });
        break;
      case 'Lead':
        // ProductInterest
        await this.prisma.productInterest.update({ where: { id: entityId }, data: { deletedAt: new Date() } });
        break;
      case 'Policy':
        await this.prisma.policy.update({ where: { id: entityId }, data: { deletedAt: new Date() } });
        break;
      case 'Claim':
        await this.prisma.claim.update({ where: { id: entityId }, data: { deletedAt: new Date() } });
        break;
      // Add more cases as needed for other entities
      default:
        console.warn(`Deletion logic not implemented for entity type: ${entityType}`);
        break;
    }
  }
}
