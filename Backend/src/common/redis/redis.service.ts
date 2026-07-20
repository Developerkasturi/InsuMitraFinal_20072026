// ─────────────────────────────────────────────────────────────────────────────
// Redis Service — thin ioredis wrapper for general-purpose KV operations.
// Used for storing short-lived tokens (password reset, email verification).
// Connection parameters mirror the BullMQ config (same Redis instance).
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis             from 'ioredis';
import { isRedisEnabled } from './redis-enabled';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  readonly client?: Redis;
  readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const redisUrl = config.get<string>('REDIS_URL');
    this.enabled = isRedisEnabled();

    if (!this.enabled || !redisUrl) {
      this.logger.log('Redis disabled');
      return;
    }

    const u = new URL(redisUrl);
    this.client = new Redis({
      host:     u.hostname,
      port:     parseInt(u.port || '6379', 10),
      password: u.password ? decodeURIComponent(u.password) : undefined,
      tls:      u.protocol === 'rediss:' ? {} : undefined,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err: any) => {
      // Suppress connection refused during startup
      if (err?.code !== 'ECONNREFUSED') {
        this.logger.error(`Redis error: ${err.message}`);
      }
    });
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.client) return;
    await this.client.quit();
  }
}
