// ─────────────────────────────────────────────────────────────────────────────
// Prisma Service — wraps PrismaClient lifecycle for NestJS DI
// ─────────────────────────────────────────────────────────────────────────────
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query'  },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn'  },
      ],
    });
  }

  async onModuleInit() {
    // Log slow queries (> 2 s) in development
    if (process.env.NODE_ENV !== 'production') {
      (this.$on as any)('query', (e: any) => {
        if (e.duration > 2000) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }
    try {
      await this.$connect();
      this.logger.log('Database connected ✓');
    } catch (err: any) {
      this.logger.error(`Database connection failed: ${err.message}`);
      // Don't throw — let the app boot; individual requests will surface DB errors
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Soft-delete helper: sets deletedAt timestamp instead of removing the row.
   * Usage: await prisma.softDelete('contact', { id: '...' })
   */
  async softDelete(model: string, where: Record<string, any>) {
    return (this as any)[model].update({
      where,
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Paginate helper — wraps findMany with count for cursor-based pagination.
   */
  async paginate<T>(
    model: string,
    args: { where?: any; orderBy?: any; take: number; skip: number; select?: any },
  ): Promise<{ data: T[]; total: number }> {
    const [data, total] = await Promise.all([
      (this as any)[model].findMany(args),
      (this as any)[model].count({ where: args.where }),
    ]);
    return { data, total };
  }
}
