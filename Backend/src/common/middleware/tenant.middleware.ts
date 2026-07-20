// ─────────────────────────────────────────────────────────────────────────────
// Tenant Middleware
// Extracts tenantId from the JWT payload and attaches it to req.tenant.
// All downstream services read req['tenantId'] to scope queries.
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  use(req: Request, _res: Response, next: NextFunction) {
    // Try to extract tenant from Authorization header
    const authHeader = req.headers['authorization'];
    const tenantHeader = req.headers['x-tenant-id'] as string;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get<string>('jwt.secret'),
        });
        // Attach decoded JWT context to request
        req['user']     = payload;
        req['tenantId'] = payload.tenantId;
      } catch {
        // Token invalid — let JwtAuthGuard handle the 401
      }
    } else if (tenantHeader) {
      // Public routes that pass tenant via header
      req['tenantId'] = tenantHeader;
    }

    next();
  }
}
