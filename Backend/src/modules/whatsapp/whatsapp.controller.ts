import {
  Controller, Get, Post, Delete, Patch,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { WhatsappService }     from './whatsapp.service';
import { JwtAuthGuard }        from '../auth/guards/jwt-auth.guard';
import { RbacGuard }           from '../../common/guards/rbac.guard';
import { Roles, CurrentUser }  from '../../common/decorators/roles.decorator';
import { SubscriptionGuard, RequireFeature } from '../../common/guards/subscription.guard';
import { PaymentService } from '../subscriptions/payment.service';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard, SubscriptionGuard)
@RequireFeature('whatsapp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly svc: WhatsappService,
    private readonly payment: PaymentService,
  ) {}

  // ── Templates ─────────────────────────────────────────────────────────────

  @Get('templates')
  @Roles(UserRole.EMPLOYEE)
  listTemplates(@CurrentUser() user: any) {
    return this.svc.listTemplates(user.tenantId);
  }

  @Post('templates')
  @Roles(UserRole.OWNER)
  createTemplate(@CurrentUser() user: any, @Body() dto: any) {
    return this.svc.createTemplate(user.tenantId, dto);
  }

  @Delete('templates/:id')
  @Roles(UserRole.OWNER)
  deleteTemplate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.deleteTemplate(user.tenantId, id);
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────

  @Get('campaigns')
  @Roles(UserRole.EMPLOYEE)
  listCampaigns(@CurrentUser() user: any, @Query() query: any) {
    return this.svc.listCampaigns(user.tenantId, query);
  }

  @Post('campaigns')
  @Roles(UserRole.OWNER)
  createCampaign(@CurrentUser() user: any, @Body() dto: any) {
    return this.svc.createCampaign(user.tenantId, dto);
  }

  @Patch('campaigns/:id/schedule')
  @Roles(UserRole.OWNER)
  scheduleCampaign(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('scheduledAt') scheduledAt: string,
  ) {
    return this.svc.scheduleCampaign(user.tenantId, id, scheduledAt);
  }

  @Post('campaigns/:id/launch')
  @Roles(UserRole.OWNER)
  launchNow(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.launchCampaignNow(user.tenantId, id);
  }

  @Get('campaigns/:id/logs')
  @Roles(UserRole.EMPLOYEE)
  getCampaignLogs(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.getCampaignLogs(user.tenantId, id);
  }

  // ── Wallet ────────────────────────────────────────────────────────────────

  @Get('wallet')
  @Roles(UserRole.OWNER)
  getWallet(@CurrentUser() user: any) {
    return this.svc.getWallet(user.tenantId);
  }

  @Post('wallet/topup')
  @Roles(UserRole.OWNER)
  topUp(@CurrentUser() user: any, @Body('amount') amount: number) {
    return this.svc.topUpWallet(user.tenantId, amount);
  }

  @Get('wallet/transactions')
  @Roles(UserRole.OWNER)
  getTransactions(@CurrentUser() user: any, @Query() query: any) {
    return this.svc.getTransactions(user.tenantId, query);
  }

  @Post('wallet/recharge/order')
  @Roles(UserRole.OWNER)
  createRechargeOrder(@CurrentUser() user: any, @Body('amount') amount: number) {
    return this.payment.createWalletOrder(user.tenantId, amount);
  }

  @Post('wallet/recharge/verify')
  @Roles(UserRole.OWNER)
  verifyRecharge(
    @CurrentUser() user: any,
    @Body() body: { amount: number; orderId: string; paymentId: string; signature: string },
  ) {
    return this.payment.verifyAndRechargeWallet(
      user.tenantId,
      body.amount,
      body.orderId,
      body.paymentId,
      body.signature,
    );
  }
}
