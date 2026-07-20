// ─────────────────────────────────────────────────────────────────────────────
// Auth Service — handles registration, login, token refresh, and user invite
// ─────────────────────────────────────────────────────────────────────────────
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService }    from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { RedisService }  from '../../common/redis/redis.service';
import { EmailService }  from '../../common/email/email.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  InviteUserDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {

  // ── Tenant profile ────────────────────────────────────────────────────────

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    return { data: tenant };
  }

  async updateTenant(tenantId: string, dto: {
    name?: string; address?: string; city?: string; state?: string;
    pincode?: string; phone?: string; website?: string; logoUrl?: string;
    gstNumber?: string; panNumber?: string; licenseNumber?: string;
    agentPhotoUrl?: string; primaryColor?: string; tagline?: string; socialMedia?: any;
  }) {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data:  dto,
    });
    return { data: tenant, message: 'Tenant updated' };
  }
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;

  constructor(
    private readonly prisma:  PrismaService,
    private readonly jwt:     JwtService,
    private readonly config:  ConfigService,
    private readonly redis:   RedisService,
    private readonly email:   EmailService,
  ) {}

  // ── Register new tenant + owner ──────────────────────────────────────────

  async register(dto: RegisterDto) {
    // Check slug uniqueness
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (existing) throw new ConflictException('Tenant slug already taken');

    // Check email uniqueness across users
    const emailExists = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (emailExists) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    // Create tenant + owner user + employee profile in one transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name:  dto.tenantName,
          slug:  dto.tenantSlug,
          email: dto.email,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId:     tenant.id,
          email:        dto.email,
          passwordHash,
          role:         UserRole.OWNER,
        },
      });

      await tx.employeeProfile.create({
        data: {
          tenantId:  tenant.id,
          userId:    user.id,
          firstName: dto.firstName,
          lastName:  dto.lastName,
          phone:     dto.phone,
        },
      });

      // Create a 14-day trial subscription to the cheapest plan
      const plan = await tx.subscriptionPlan.findFirst({
        orderBy: { priceMonthly: 'asc' },
      });
      if (plan) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + (plan.trialDays || 14));

        await tx.subscription.create({
          data: {
            tenantId:  tenant.id,
            planId:    plan.id,
            status:    'TRIAL',
            startDate: new Date(),
            endDate:   trialEnd,
            trialEnd,
          },
        });
      }

      return { tenant, user };
    });

    return this.generateTokens(result.user);
  }

  // ── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where:  { email: dto.email },
      include: { tenant: { select: { isActive: true, slug: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.tenant.isActive) {
      throw new UnauthorizedException('Your agency account has been deactivated');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data:  { lastLoginAt: new Date() },
    });

    return this.generateTokens(user);
  }

  // ── Refresh access token ─────────────────────────────────────────────────

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const payload = this.jwt.verify(dto.refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found');
      }

      // Validate stored refresh token matches
      const storedHashMatches = user.refreshToken
        ? await bcrypt.compare(dto.refreshToken, user.refreshToken)
        : false;

      if (!storedHashMatches) {
        throw new UnauthorizedException('Refresh token revoked');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  // ── Change password ──────────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data:  { passwordHash, refreshToken: null },
    });

    return { message: 'Password changed successfully' };
  }

  // ── Invite a new employee ────────────────────────────────────────────────

  async inviteUser(tenantId: string, dto: InviteUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
    if (existing) throw new ConflictException('Email already exists in this agency');

    const tempPassword = dto.password || Math.random().toString(36).slice(-10);
    const passwordHash = await bcrypt.hash(tempPassword, this.SALT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { tenantId, email: dto.email, passwordHash, role: dto.role },
      });

      await tx.employeeProfile.create({
        data: {
          tenantId,
          userId:    newUser.id,
          firstName: dto.firstName,
          lastName:  dto.lastName,
          phone:     dto.phone,
        },
      });

      return newUser;
    });

    this.logger.log(`New user invited: ${dto.email} in tenant ${tenantId}`);

    return { userId: user.id, email: dto.email, tempPassword };
  }

  // ── Invite a contact to the client portal ───────────────────────────────

  async inviteContact(tenantId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      include: { tenant: { select: { name: true } } },
    });

    if (!contact) {
      throw new BadRequestException('Contact not found');
    }

    if (contact.userId) {
      throw new ConflictException('Contact already has portal access');
    }

    if (!contact.email) {
      throw new BadRequestException('Contact must have an email address to receive portal access');
    }

    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: contact.email },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists in this agency');
    }

    const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-2).toUpperCase();
    const passwordHash = await bcrypt.hash(tempPassword, this.SALT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { tenantId, email: contact.email!, passwordHash, role: UserRole.CONTACT },
      });

      await tx.contact.update({
        where: { id: contactId },
        data:  { userId: newUser.id },
      });

      return newUser;
    });

    const name = `${contact.firstName} ${contact.lastName}`;
    this.email.sendContactInviteEmail(contact.email, name, tempPassword, contact.tenant.name)
      .catch(e => this.logger.error(`Failed to send invite email: ${e.message}`));

    this.logger.log(`Contact ${contactId} invited to portal as user ${user.id}`);
    return { message: 'Invitation sent successfully', userId: user.id };
  }

  // ── Forgot password ──────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email } });
    // Always return success to avoid user enumeration
    if (!user || !user.isActive) {
      return { message: 'If an account with that email exists, a reset link has been sent.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    // Store in Redis with 1-hour TTL
    await this.redis.set(`pwreset:${token}`, user.id, 3600);

    // Fire-and-forget email
    this.email.sendPasswordResetEmail(user.email, token).catch((e) =>
      this.logger.error(`Failed to send reset email: ${e.message}`),
    );

    return { message: 'If an account with that email exists, a reset link has been sent.' };
  }

  // ── Reset password via token ────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const userId = await this.redis.get(`pwreset:${dto.token}`);
    if (!userId) throw new BadRequestException('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data:  { passwordHash, refreshToken: null },
    });

    // Invalidate the token immediately after use
    await this.redis.del(`pwreset:${dto.token}`);

    return { message: 'Password reset successfully. Please login with your new password.' };
  }

  // ── Logout (revoke refresh token) ────────────────────────────────────────

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data:  { refreshToken: null },
    });
    return { message: 'Logged out successfully' };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async generateTokens(user: {
    id: string; email: string; role: string; tenantId: string;
  }) {
    const payload = {
      sub:      user.id,
      email:    user.email,
      role:     user.role,
      tenantId: user.tenantId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret:    this.config.get<string>('jwt.secret'),
        expiresIn: this.config.get<string>('jwt.expiresIn', '7d'),
      }),
      this.jwt.signAsync(payload, {
        secret:    this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiry', '30d'),
      }),
    ]);

    // Store hashed refresh token
    const refreshHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data:  { refreshToken: refreshHash },
    });

    // Fetch profile for name fields
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { firstName: true, lastName: true },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: '7d',
      user: {
        id:        user.id,
        email:     user.email,
        role:      user.role,
        tenantId:  user.tenantId,
        firstName: profile?.firstName ?? '',
        lastName:  profile?.lastName  ?? '',
      },
    };
  }
}
