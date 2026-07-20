// ─────────────────────────────────────────────────────────────────────────────
// Root Application Module
// Registers all feature modules and global providers
// ─────────────────────────────────────────────────────────────────────────────
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';

import { envConfig }           from './config/env.config';
import { DatabaseModule }      from './database/database.module';
import { TenantMiddleware }    from './common/middleware/tenant.middleware';

// Feature modules
import { AuthModule }          from './modules/auth/auth.module';
import { ContactsModule }      from './modules/contacts/contacts.module';
import { LeadsModule }         from './modules/leads/leads.module';
import { PoliciesModule }      from './modules/policies/policies.module';
import { ClaimsModule }        from './modules/claims/claims.module';
import { EmployeesModule }     from './modules/employees/employees.module';
import { CommissionsModule }   from './modules/commissions/commissions.module';
import { WhatsappModule }      from './modules/whatsapp/whatsapp.module';
import { CalendarModule }      from './modules/calendar/calendar.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DocumentsModule }     from './modules/documents/documents.module';
import { SearchModule }        from './modules/search/search.module';
import { DashboardModule }     from './modules/dashboard/dashboard.module';
import { InsuranceModule }     from './modules/insurance/insurance.module';
import { ClientModule }        from './modules/client/client.module';
import { WorkspaceModule }     from './modules/workspace/workspace.module';
import { FeedbackModule }      from './modules/feedback/feedback.module';
import { JobsModule }          from './jobs/jobs.module';
import { EmailModule }         from './common/email/email.module';
import { AgencyDetailsModule } from './modules/agency-details/agency-details.module';
import { BannersModule }       from './modules/banners/banners.module';
import { RedisModule }         from './common/redis/redis.module';
import { getRedisUrl, isRedisEnabled } from './common/redis/redis-enabled';
import { WebSocketModule }     from './common/websocket/websocket.module';
import { DeletionRequestsModule } from './modules/deletion-requests/deletion-requests.module';
import { HealthController }    from './health.controller';

const redisEnabled = isRedisEnabled();

@Module({
  controllers: [HealthController],
  imports: [
    // ── Config ──────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig],
      envFilePath: ['.env'],
    }),

    // ── Rate limiting ────────────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        throttlers: [{
          ttl:   cfg.get<number>('THROTTLE_TTL',   60) * 1000,
          limit: cfg.get<number>('THROTTLE_LIMIT', 100),
        }],
      }),
    }),

    // ── BullMQ (Redis queue) ─────────────────────────────────────────────────
    ...(redisEnabled ? [BullModule.forRootAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (cfg: ConfigService) => {
        // ── Build ioredis connection from REDIS_URL (Upstash / cloud)
        // or fall back to individual REDIS_HOST/PORT/PASSWORD (local/Docker).
        const redisUrl = cfg.get<string>('REDIS_URL');
        let connection: Record<string, any>;

        if (redisUrl) {
          const u = new URL(redisUrl);
          connection = {
            host:                 u.hostname,
            port:                 parseInt(u.port || '6379', 10),
            password:             u.password ? decodeURIComponent(u.password) : undefined,
            // Upstash uses rediss:// (TLS); rediss → enable TLS, redis → plain
            tls:                  u.protocol === 'rediss:' ? {} : undefined,
            enableReadyCheck:     false,
            maxRetriesPerRequest: null,
            retryStrategy:        (times: number) => Math.min(times * 500, 5_000),
          };
        } else {
          connection = {
            host:                 cfg.get<string>('REDIS_HOST', 'localhost'),
            port:                 cfg.get<number>('REDIS_PORT', 6379),
            password:             cfg.get<string>('REDIS_PASSWORD') || undefined,
            enableReadyCheck:     false,
            maxRetriesPerRequest: null,
            retryStrategy:        (times: number) => Math.min(times * 1000, 30_000),
          };
        }

        return {
          connection,
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail:     50,
            attempts:         3,
            backoff: { type: 'exponential', delay: 2000 },
          },
        };
      },
    })] : []),

    // ── Core & feature modules ───────────────────────────────────────────────
    DatabaseModule,
    EmailModule,
    RedisModule,
    WebSocketModule,
    AuthModule,
    ContactsModule,
    LeadsModule,
    PoliciesModule,
    ClaimsModule,
    EmployeesModule,
    CommissionsModule,
    WhatsappModule,
    CalendarModule,
    SubscriptionsModule,
    NotificationsModule,
    DocumentsModule,
    SearchModule,
    DashboardModule,
    InsuranceModule,
    ClientModule,
    WorkspaceModule,
    FeedbackModule,
    AgencyDetailsModule,
    BannersModule,
    DeletionRequestsModule,
    ...(redisEnabled ? [JobsModule] : []),
  ],
})
export class AppModule implements NestModule {
  /**
   * Apply TenantMiddleware to all routes except auth.
   * The middleware extracts tenant context from JWT or X-Tenant-ID header.
   */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude('api/v1/auth/(.*)', 'api/v1/health')
      .forRoutes('*');
  }
}
