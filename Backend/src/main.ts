// ─────────────────────────────────────────────────────────────────────────────
// InsuMitra Backend — Application Entry Point
// ─────────────────────────────────────────────────────────────────────────────
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { WinstonModule } from 'nest-winston';
import * as compression from 'compression';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { winstonConfig } from './common/utils/logger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { PrismaService } from './database/prisma.service';

async function bootstrap() {
  // Suppress unhandled Redis / ioredis connection-refused errors so the
  // process stays alive while Docker is starting up. Actual job failures
  // are handled per-worker with BullMQ's built-in retry logic.
  process.on('uncaughtException', (err: any) => {
    const msg = err?.message ?? '';
    if (msg === 'Connection is closed' || err?.code === 'ECONNREFUSED') return;
    console.error('uncaughtException:', err);
    process.exit(1);
  });

  // Create NestJS application with Winston logger
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:5173');

  // ── Socket.IO adapter for WebSocket gateway ────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app));

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(compression());

  // ── CORS ──────────────────────────────────────────────────────────────────
  const allowedOrigins = [
    frontendUrl,
    'https://insumitr.exportshub.in',
    'https://www.insumitr.exportshub.in',
    'https://insumitr.exportshub.in/',
    'https://www.insumitr.exportshub.in/',
    'https://insumitra-testing.onrender.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
  ].filter((v, i, a) => v && a.indexOf(v) === i); // deduplicate & remove falsy

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    exposedHeaders: ['Content-Disposition'],
  });

  // ── Global prefix & versioning ────────────────────────────────────────────
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({ type: VersioningType.URI });

  // ── Global pipes, filters, interceptors ───────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // strip properties not in DTO
      forbidNonWhitelisted: true,
      transform: true,          // auto-transform payloads to DTO instances
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalInterceptors(new AuditInterceptor(app.get(PrismaService)));

  // ── Swagger (disable in production) ───────────────────────────────────────
  if (configService.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('InsuMitra API')
      .setDescription('Multi-tenant SaaS Insurance CRM REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .addServer(`http://localhost:${port}`)
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port);
  console.log(`🚀 InsuMitra API listening on http://localhost:${port}/${apiPrefix}`);
  console.log(`📚 Swagger docs at    http://localhost:${port}/${apiPrefix}/docs`);
}

bootstrap();
