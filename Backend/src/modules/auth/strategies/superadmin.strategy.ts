// ─────────────────────────────────────────────────────────────────────────────
// SuperAdmin Passport Strategy
// Validates tokens issued to platform super-administrators (separate DB model).
// Uses a different JWT secret so tokens are non-interchangeable with tenant JWTs.
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService }    from '@nestjs/config';
import { PrismaService }    from '../../../database/prisma.service';

export interface SuperAdminPayload {
  sub:   string;   // superAdminId
  email: string;
  type:  'superadmin';
}

@Injectable()
export class SuperAdminStrategy extends PassportStrategy(Strategy, 'superadmin') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma:        PrismaService,
  ) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      configService.get<string>('jwt.superadminSecret',
                          configService.get<string>('jwt.secret', 'change_me')),
    });
  }

  async validate(payload: SuperAdminPayload) {
    if (payload.type !== 'superadmin') {
      throw new UnauthorizedException('Not a superadmin token');
    }

    const admin = await this.prisma.superAdmin.findUnique({
      where:  { id: payload.sub },
      select: { id: true, email: true, isActive: true },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('SuperAdmin not found or inactive');
    }

    return { id: admin.id, email: admin.email, role: 'SUPERADMIN', type: 'superadmin' };
  }
}
