import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AgencyDetailsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: any) {
    const detail = await this.prisma.agencyDetail.create({
      data: {
        ...dto,
        tenantId,
      },
    });
    return { data: detail, message: 'Agency detail created' };
  }

  async findAll(tenantId: string) {
    const details = await this.prisma.agencyDetail.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return { data: details };
  }

  async update(tenantId: string, id: string, dto: any) {
    const existing = await this.prisma.agencyDetail.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Agency detail not found');

    const detail = await this.prisma.agencyDetail.update({
      where: { id },
      data: dto,
    });
    return { data: detail, message: 'Agency detail updated' };
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.agencyDetail.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Agency detail not found');

    await this.prisma.agencyDetail.delete({ where: { id } });
    return { message: 'Agency detail deleted' };
  }
}
