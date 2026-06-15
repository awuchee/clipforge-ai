import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Plan, Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { SafeUser } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe?: Stripe;

  constructor(
    private config: ConfigService,
    private users: UsersService,
    private prisma: PrismaService,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
    }
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured on this server');
    }
    return this.stripe;
  }

  /** Finds (or creates) the Stripe customer for a user. */
  private async getOrCreateCustomerId(user: SafeUser): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const stripe = this.requireStripe();
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });

    await this.users.setStripeCustomerId(user.id, customer.id);
    return customer.id;
  }

  /** Creates a Stripe Checkout Session (subscription mode) for the Pro plan. */
  async createCheckoutSession(user: SafeUser): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const priceId = this.config.get<string>('STRIPE_PRICE_PRO_ID');
    if (!priceId) {
      throw new BadRequestException('STRIPE_PRICE_PRO_ID is not configured');
    }

    const customerId = await this.getOrCreateCustomerId(user);
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/dashboard/billing?checkout=success`,
      cancel_url: `${frontendUrl}/dashboard/billing?checkout=cancelled`,
      client_reference_id: user.id,
      subscription_data: { metadata: { userId: user.id } },
    });

    if (!session.url) {
      throw new BadRequestException('Failed to create checkout session');
    }

    return { url: session.url };
  }

  /** Creates a Stripe Billing Portal session for managing/cancelling a subscription. */
  async createPortalSession(user: SafeUser): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    if (!user.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer found for this account');
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${frontendUrl}/dashboard/billing`,
    });

    return { url: session.url };
  }

  /** Verifies and parses a raw webhook payload into a Stripe event. */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const stripe = this.requireStripe();
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not configured');
    }

    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }

  /**
   * Applies a Stripe webhook event to the local database.
   *
   * Idempotent/retry-safe: Stripe retries delivery on any non-2xx response, and
   * can also send the same event more than once. We record each event ID before
   * processing; if the ID is already recorded (unique constraint violation), the
   * event has already been applied and we skip it.
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      await this.prisma.processedStripeEvent.create({ data: { id: event.id, type: event.type } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.log(`Skipping already-processed Stripe event ${event.id} (${event.type})`);
        return;
      }
      throw err;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        if (!userId || !session.subscription) {
          this.logger.warn(`checkout.session.completed missing userId/subscription (session ${session.id})`);
          break;
        }

        const stripe = this.requireStripe();
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await this.applySubscription(userId, subscription);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId ?? (await this.findUserIdByCustomer(subscription.customer as string));
        if (!userId) {
          this.logger.warn(`${event.type} missing userId (subscription ${subscription.id})`);
          break;
        }

        await this.applySubscription(userId, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId ?? (await this.findUserIdByCustomer(subscription.customer as string));
        if (!userId) {
          this.logger.warn(`customer.subscription.deleted missing userId (subscription ${subscription.id})`);
          break;
        }

        await this.users.updateSubscription(userId, {
          plan: Plan.FREE,
          stripeSubscriptionId: null,
          subscriptionStatus: 'canceled',
          currentPeriodEnd: null,
        });
        break;
      }

      default:
        this.logger.debug(`Unhandled Stripe webhook event: ${event.type}`);
    }
  }

  private async findUserIdByCustomer(customerId: string): Promise<string | null> {
    const user = await this.users.findByStripeCustomerId(customerId);
    return user?.id ?? null;
  }

  private async applySubscription(userId: string, subscription: Stripe.Subscription): Promise<void> {
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';

    await this.users.updateSubscription(userId, {
      plan: isActive ? Plan.PRO : Plan.FREE,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    });
  }
}
