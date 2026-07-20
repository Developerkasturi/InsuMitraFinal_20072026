import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DeletionRequestsService {
  constructor(private prisma: PrismaService) {}

  async createRequest(tenantId: string, userId: string, entityType: string, entityId: string, reason?: string) {
    const request = await this.prisma.deletionRequest.create({
      data: {
        tenantId,
        requestedBy: userId,
        entityType,
        entityId,
        reason,
        status: 'PENDING',
      },
    });

    await this.logActivity(tenantId, userId, entityType, entityId, 'DELETE_REQUESTED', `Deletion request submitted for ${entityType}`, {
      requestId: request.id,
      reason,
    });

    return request;
  }

  async findAll(tenantId: string) {
    return this.prisma.deletionRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllGlobal() {
    return this.prisma.deletionRequest.findMany({
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
      await this.logActivity(tenantId, adminId, request.entityType, request.entityId, 'DELETE_APPROVED', `Deletion approved for ${request.entityType}`, {
        requestId,
      });
    } else {
      await this.logActivity(tenantId, adminId, request.entityType, request.entityId, 'DELETE_REJECTED', `Deletion rejected for ${request.entityType}`, {
        requestId,
      });
    }

    return updated;
  }

  async resolveRequestGlobal(requestId: string, adminId: string, action: 'APPROVED' | 'REJECTED') {
    const request = await this.prisma.deletionRequest.findFirst({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== 'PENDING') {
      throw new ForbiddenException('Request already resolved');
    }

    const updated = await this.prisma.deletionRequest.update({
      where: { id: requestId },
      data: {
        status: action,
        resolvedBy: adminId,
        resolvedAt: new Date(),
      },
    });

    if (action === 'APPROVED') {
      await this.executeDeletion(request.tenantId, request.entityType, request.entityId);
      await this.logActivity(request.tenantId, adminId, request.entityType, request.entityId, 'DELETE_APPROVED', `Deletion approved for ${request.entityType}`, {
        requestId,
      });
    } else {
      await this.logActivity(request.tenantId, adminId, request.entityType, request.entityId, 'DELETE_REJECTED', `Deletion rejected for ${request.entityType}`, {
        requestId,
      });
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
      case 'CalendarEvent':
        await this.prisma.calendarEvent.update({ where: { id: entityId }, data: { deletedAt: new Date() } });
        break;
      case 'Commission':
        await this.prisma.commission.delete({ where: { id: entityId } });
        break;
      case 'Document':
        await this.prisma.document.update({ where: { id: entityId }, data: { deletedAt: new Date() } });
        break;
      case 'InsuranceCompany':
        await this.prisma.insuranceCompany.update({ where: { id: entityId }, data: { isActive: false } });
        break;
      case 'InsurancePlan':
        await this.prisma.insurancePlan.update({ where: { id: entityId }, data: { isActive: false } });
        break;
      case 'AgencyDetail':
        await this.prisma.agencyDetail.delete({ where: { id: entityId } });
        break;
      case 'Banner':
        await this.prisma.banner.delete({ where: { id: entityId } });
        break;
      default:
        console.warn(`Deletion logic not implemented for entity type: ${entityType}`);
        break;
    }
  }

  private async logActivity(
    tenantId: string,
    userId: string,
    entityType: string,
    entityId: string,
    action: string,
    description: string,
    metadata: Record<string, any> = {},
  ) {
    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          userId,
          entityType,
          entityId,
          action,
          description,
          metadata,
        },
      });
    } catch (error) {
      console.warn(`Failed to write deletion activity log for ${entityType} ${entityId}:`, error);
    }
  }
}
