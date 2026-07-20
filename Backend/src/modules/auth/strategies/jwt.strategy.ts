// ─────────────────────────────────────────────────────────────────────────────
// JWT Passport Strategy
// Validates Bearer tokens and populates req.user with the decoded payload.
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService }   from '@nestjs/config';
import { PrismaService }   from '../../../database/prisma.service';

export interface JwtPayload {
  sub:      string;   // userId
  email:    string;
  role:     string;
  tenantId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    // Verify the user still exists and is active
    const user = await this.prisma.user.findUnique({
      where:  { id: payload.sub },
      select: { id: true, isActive: true, role: true, tenantId: true, email: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // This return value becomes req.user
    return {
      id:       user.id,
      email:    user.email,
      role:     user.role,
      tenantId: user.tenantId,
    };
  }
}
