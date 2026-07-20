// ─────────────────────────────────────────────────────────────────────────────
// Payment Service — Razorpay integration via HTTP REST API (no SDK needed)
//
// Flow:
//   1. createOrder(tenantId, planId) → returns Razorpay order with orderId
//   2. Frontend collects payment using Razorpay checkout.js
//   3. verifyAndActivate(tenantId, planId, orderId, paymentId, signature)
//      → verifies HMAC-SHA256, activates subscription, records payment
// ─────────────────────────────────────────────────────────────────────────────
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly razorpayBaseUrl = 'https://api.razorpay.com/v1';

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
  ) {}

  // ── Create Razorpay order ──────────────────────────────────────────────────

  async createOrder(tenantId: string, planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Plan not found');

    const keyId     = this.config.get<string>('razorpay.keyId');
    const keySecret = this.config.get<string>('razorpay.keySecret');

    if (!keyId || !keySecret) {
      throw new BadRequestException('Payment gateway not configured. Contact support.');
    }

    // Amount in paise (INR smallest unit); priceMonthly is in rupees
    const amountPaise = Math.round(Number(plan.priceMonthly) * 100);
    const receipt = `sub_${tenantId.slice(0, 8)}_${Date.now()}`;

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch(`${this.razorpayBaseUrl}/orders`, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount:   amountPaise,
        currency: 'INR',
        receipt,
        notes: { tenantId, planId },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Razorpay order creation failed: ${err}`);
      throw new BadRequestException('Failed to create payment order. Please try again.');
    }

    const order = await res.json() as any;
    return {
      data: {
        orderId:    order.id,
        amount:     order.amount,
        currency:   order.currency,
        receipt:    order.receipt,
        planId,
        planName:   plan.name,
        keyId,      // Returned to frontend for checkout.js initialization
      },
    };
  }

  // ── Verify payment and activate subscription ───────────────────────────────

  async verifyAndActivate(
    tenantId: string,
    planId:   string,
    orderId:  string,
    paymentId: string,
    signature: string,
  ) {
    // Verify HMAC-SHA256 signature: orderId + "|" + paymentId
    const keySecret = this.config.get<string>('razorpay.keySecret', '');
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new BadRequestException('Payment verification failed: invalid signature');
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Plan not found');

    // Activate subscription in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Cancel existing active subscriptions
      await tx.subscription.updateMany({
        where: { tenantId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
        data:  { status: SubscriptionStatus.CANCELLED },
      });

      const startDate = new Date();
      const endDate   = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // 1-month subscription

      const subscription = await tx.subscription.create({
        data: {
          tenantId,
          planId:    plan.id,
          status:    SubscriptionStatus.ACTIVE,
          startDate,
          endDate,
        },
        include: { plan: true },
      });

      // Record the payment
      await tx.subscriptionPayment.create({
        data: {
          subscriptionId: subscription.id,
          amount:    plan.priceMonthly,
          currency:  'INR',
          status:    'PAID',
          gateway:   'RAZORPAY',
          gatewayId: paymentId,  // Razorpay payment ID
          paidAt:    new Date(),
        },
      });

      return subscription;
    });

    this.logger.log(`Subscription activated for tenant ${tenantId}, plan ${plan.name}`);
    return { data: result, message: `Successfully upgraded to ${plan.name}` };
  }

  async createWalletOrder(tenantId: string, amount: number) {
    const keyId     = this.config.get<string>('razorpay.keyId');
    const keySecret = this.config.get<string>('razorpay.keySecret');

    if (!keyId || !keySecret) {
      throw new BadRequestException('Payment gateway not configured. Contact support.');
    }

    const amountPaise = Math.round(Number(amount) * 100);
    const receipt = `wallet_${tenantId.slice(0, 8)}_${Date.now()}`;

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch(`${this.razorpayBaseUrl}/orders`, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount:   amountPaise,
        currency: 'INR',
        receipt,
        notes: { tenantId, type: 'wallet_recharge' },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Razorpay order creation failed for wallet: ${err}`);
      throw new BadRequestException('Failed to create payment order. Please try again.');
    }

    const order = await res.json() as any;
    return {
      data: {
        orderId:    order.id,
        amount:     order.amount,
        currency:   order.currency,
        receipt:    order.receipt,
        keyId,
      },
    };
  }

  async verifyAndRechargeWallet(
    tenantId: string,
    amount:   number,
    orderId:  string,
    paymentId: string,
    signature: string,
  ) {
    // Verify signature
    const keySecret = this.config.get<string>('razorpay.keySecret', '');
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new BadRequestException('Payment verification failed: invalid signature');
    }

    // Recharge wallet by incrementing balance in database
    const wallet = await this.prisma.whatsappWallet.findFirst({ where: { tenantId } });
    if (!wallet) throw new NotFoundException('WhatsApp wallet not found for tenant');

    const updated = await this.prisma.whatsappWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: Number(amount) },
      },
    });

    // Record the transaction
    await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount: Number(amount),
        balanceAfter: updated.balance,
        description: `Wallet recharge via Razorpay`,
        referenceId: paymentId,
      },
    });

    return { data: updated, message: `Successfully recharged wallet by ₹${amount}` };
  }
}
