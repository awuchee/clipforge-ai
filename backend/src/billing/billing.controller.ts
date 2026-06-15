import { BadRequestException, Controller, Headers, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/auth.service';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private billing: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  createCheckoutSession(@CurrentUser() user: SafeUser) {
    return this.billing.createCheckoutSession(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('portal')
  createPortalSession(@CurrentUser() user: SafeUser) {
    return this.billing.createPortalSession(user);
  }

  @Post('webhook')
  async handleWebhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    if (!signature || !req.rawBody) {
      throw new BadRequestException('Missing Stripe signature or raw body');
    }

    const event = this.billing.constructWebhookEvent(req.rawBody, signature);
    await this.billing.handleWebhookEvent(event);
    return { received: true };
  }
}
