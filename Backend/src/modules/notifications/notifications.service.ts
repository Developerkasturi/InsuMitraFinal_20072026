import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsGateway } from '../../common/websocket/notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly gateway?: NotificationsGateway,
  ) {}

  async list(tenantId: string, userId: string, query: any) {
    const pageNum  = Math.max(1, parseInt(query.page,  10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const unreadOnly = query.unreadOnly;
    const skip = (pageNum - 1) * limitNum;

    const where: any = { tenantId, userId };
    if (unreadOnly === 'true' || unreadOnly === true) where.isRead = false;

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take:    limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { tenantId, userId, isRead: false } }),
    ]);

    return { data, meta: { total, page: pageNum, limit: limitNum, unreadCount } };
  }

  async markRead(tenantId: string, userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, tenantId, userId },
      data:  { isRead: true, readAt: new Date() },
    });
    return { data: null, message: 'Notification marked as read' };
  }

  // ── Create a notification and push to WebSocket ──────────────────────────
  async create(data: {
    tenantId: string;
    userId:   string;
    type:     string;
    title:    string;
    body:     string;
    link?:    string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: data.tenantId,
        userId:   data.userId,
        type:     data.type as any,
        title:    data.title,
        body:     data.body,
        data:     data.link ? { link: data.link } : {},
      },
    });
    // Push real-time event to connected socket
    this.gateway?.sendToUser(data.userId, 'notification', notification);
    return notification;
  }

  async markAllRead(tenantId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    });
    return { data: null, message: 'All notifications marked as read' };
  }

  async delete(tenantId: string, userId: string, id: string) {
    await this.prisma.notification.deleteMany({
      where: { id, tenantId, userId },
    });
    return { data: null, message: 'Notification deleted' };
  }

  async countUnread(tenantId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: { tenantId, userId, isRead: false },
    });
    return { data: { count } };
  }
}
