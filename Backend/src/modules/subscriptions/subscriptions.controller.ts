import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SubscriptionsService } from './subscriptions.service';
import { PaymentService } from './payment.service';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard, TenantGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly svc: SubscriptionsService,
    private readonly payment: PaymentService,
  ) {}

  @Get('plans')
  listPlans() {
    return this.svc.listPlans();
  }

  @Get('current')
  current(@Req() req: any) {
    return this.svc.getCurrent(req.tenantId);
  }

  @Get('limits/:resource')
  checkLimit(@Req() req: any, @Param('resource') resource: any) {
    return this.svc.checkLimit(req.tenantId, resource);
  }

  @Post('upgrade/:planId')
  @Roles(UserRole.OWNER)
  upgrade(@Req() req: any, @Param('planId') planId: string) {
    return this.svc.upgrade(req.tenantId, planId);
  }

  @Delete('cancel')
  @Roles(UserRole.OWNER)
  cancel(@Req() req: any) {
    return this.svc.cancel(req.tenantId);
  }

  @Get('billing')
  @Roles(UserRole.OWNER)
  billing(@Req() req: any) {
    return this.svc.getBillingHistory(req.tenantId);
  }

  // ── Razorpay payment integration ─────────────────────────────────────────

  @Post('create-order')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create a Razorpay order for plan upgrade' })
  createOrder(@Req() req: any, @Body() body: { planId: string }) {
    return this.payment.createOrder(req.tenantId, body.planId);
  }

  @Post('verify-payment')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Verify Razorpay payment and activate subscription' })
  verifyPayment(
    @Req() req: any,
    @Body() body: { planId: string; orderId: string; paymentId: string; signature: string },
  ) {
    return this.payment.verifyAndActivate(
      req.tenantId,
      body.planId,
      body.orderId,
      body.paymentId,
      body.signature,
    );
  }
}
