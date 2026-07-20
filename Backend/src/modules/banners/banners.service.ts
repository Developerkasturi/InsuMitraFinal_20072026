import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: any) {
    const detail = await this.prisma.banner.create({
      data: {
        ...dto,
        tenantId,
      },
    });
    return { data: detail, message: 'Banner created' };
  }

  async findAll(tenantId: string) {
    const details = await this.prisma.banner.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
    });
    return { data: details };
  }

  async update(tenantId: string, id: string, dto: any) {
    const existing = await this.prisma.banner.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Banner not found');

    const detail = await this.prisma.banner.update({
      where: { id },
      data: dto,
    });
    return { data: detail, message: 'Banner updated' };
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.banner.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Banner not found');

    await this.prisma.banner.delete({ where: { id } });
    return { message: 'Banner deleted' };
  }
}
