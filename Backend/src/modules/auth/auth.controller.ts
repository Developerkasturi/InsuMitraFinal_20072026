import {
  Controller, Post, Patch, Body, UseGuards, Get, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { AuthService }         from './auth.service';
import { JwtAuthGuard }        from './guards/jwt-auth.guard';
import { RbacGuard }           from '../../common/guards/rbac.guard';
import { Roles, CurrentUser, Public }  from '../../common/decorators/roles.decorator';
import { SubscriptionGuard, RequireFeature } from '../../common/guards/subscription.guard';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  InviteUserDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateTenantDto,
} from './dto/auth.dto';
import { UserRole } from '@prisma/client';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Register new agency + owner account */
  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new tenant (agency)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /** Login with email + password */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtain access & refresh tokens' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Exchange refresh token for new tokens */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  /** Get current authenticated user profile */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  me(@CurrentUser() user: any) {
    return { data: user };
  }

  /** Change own password */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  /** Invite a new user to the tenant (Owner+ only) */
  @Post('invite')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite a new employee to the agency' })
  invite(@CurrentUser() user: any, @Body() dto: InviteUserDto) {
    return this.authService.inviteUser(user.tenantId, dto);
  }

  /** Logout — revoke refresh token */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser() user: any) {
    return this.authService.logout(user.id);
  }

  /** Get current tenant profile */
  @Get('/tenants/current')
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequireFeature('branding')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current tenant profile' })
  getTenant(@CurrentUser() user: any) {
    return this.authService.getTenant(user.tenantId);
  }

  /** Update current tenant profile */
  @Patch('/tenants/current')
  @UseGuards(JwtAuthGuard, RbacGuard, SubscriptionGuard)
  @Roles(UserRole.OWNER)
  @RequireFeature('branding')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update tenant profile' })
  updateTenant(@CurrentUser() user: any, @Body() dto: UpdateTenantDto) {
    return this.authService.updateTenant(user.tenantId, dto);
  }

  /** Request a password reset email */
  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /** Reset password using the token from email */
  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
