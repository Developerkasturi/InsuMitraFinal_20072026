// ─────────────────────────────────────────────────────────────────────────────
// JWT Auth Guard — validates Bearer tokens.
// Routes decorated with @Public() bypass this guard entirely.
// ─────────────────────────────────────────────────────────────────────────────
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector }                   from '@nestjs/core';
import { AuthGuard }                   from '@nestjs/passport';
import { IS_PUBLIC_KEY }               from '../../../common/decorators/roles.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // If the route (or its controller) is marked @Public(), skip auth entirely
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    return super.canActivate(context);
  }
}
