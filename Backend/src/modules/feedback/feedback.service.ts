import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async createFeedback(tenantId: string, userId: string, message: string, rating?: number) {
    const feedback = await this.prisma.featureFeedback.create({
      data: {
        tenantId,
        userId,
        message,
        rating: rating !== undefined ? Number(rating) : null,
      },
    });
    return { data: feedback, message: 'Thank you for your feedback!' };
  }

  async getAllFeedback(tenantId: string) {
    const data = await this.prisma.featureFeedback.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return { data };
  }
}
