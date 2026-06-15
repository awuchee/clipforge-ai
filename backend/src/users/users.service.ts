import { Injectable } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByStripeCustomerId(stripeCustomerId: string) {
    return this.prisma.user.findUnique({ where: { stripeCustomerId } });
  }

  create(data: { email: string; password: string; name: string }) {
    return this.prisma.user.create({ data });
  }

  setStripeCustomerId(userId: string, stripeCustomerId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId } });
  }

  updateSubscription(
    userId: string,
    data: {
      plan: Plan;
      stripeSubscriptionId: string | null;
      subscriptionStatus: string | null;
      currentPeriodEnd: Date | null;
    },
  ) {
    return this.prisma.user.update({ where: { id: userId }, data });
  }
}
