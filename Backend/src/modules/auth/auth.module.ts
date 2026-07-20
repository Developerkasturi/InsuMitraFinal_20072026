import { Module } from '@nestjs/common';
import { JwtModule }      from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController }       from './auth.controller';
import { SuperAdminAuthController } from './superadmin-auth.controller';
import { AuthService }          from './auth.service';
import { SuperAdminAuthService } from './superadmin-auth.service';
import { JwtStrategy }          from './strategies/jwt.strategy';
import { SuperAdminStrategy }   from './strategies/superadmin.strategy';
import { JwtAuthGuard }         from './guards/jwt-auth.guard';
import { SuperAdminAuthGuard }  from './guards/superadmin-auth.guard';
import { RbacGuard }            from '../../common/guards/rbac.guard';
import { TenantGuard }          from '../../common/guards/tenant.guard';
import { EmployeeScopeGuard }   from '../../common/guards/employee-scope.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret:      cfg.get<string>('jwt.secret'),
        signOptions: { expiresIn: cfg.get<string>('jwt.expiresIn', '7d') },
      }),
    }),
  ],
  controllers: [AuthController, SuperAdminAuthController],
  providers:   [
    AuthService,
    SuperAdminAuthService,
    JwtStrategy,
    SuperAdminStrategy,
    JwtAuthGuard,
    SuperAdminAuthGuard,
    RbacGuard,
    TenantGuard,
    EmployeeScopeGuard,
  ],
  exports: [AuthService, JwtAuthGuard, SuperAdminAuthGuard, RbacGuard, TenantGuard, EmployeeScopeGuard, JwtModule],
})
export class AuthModule {}
