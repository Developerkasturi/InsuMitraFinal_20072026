// ─────────────────────────────────────────────────────────────────────────────
// SuperAdmin Auth Guard
// Use on routes that must only be accessed by platform superadmins.
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable } from '@nestjs/common';
import { AuthGuard }  from '@nestjs/passport';

@Injectable()
export class SuperAdminAuthGuard extends AuthGuard('superadmin') {}
