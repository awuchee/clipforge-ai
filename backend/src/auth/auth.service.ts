import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

const SALT_ROUNDS = 10;

export type SafeUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: string;
  videosUsedThisMonth: number;
  createdAt: Date;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: Date | null;
};

function toSafeUser(user: {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: string;
  videosUsedThisMonth: number;
  createdAt: Date;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: Date | null;
}): SafeUser {
  const {
    id,
    email,
    name,
    avatarUrl,
    plan,
    videosUsedThisMonth,
    createdAt,
    stripeCustomerId,
    stripeSubscriptionId,
    subscriptionStatus,
    currentPeriodEnd,
  } = user;
  return {
    id,
    email,
    name,
    avatarUrl,
    plan,
    videosUsedThisMonth,
    createdAt,
    stripeCustomerId,
    stripeSubscriptionId,
    subscriptionStatus,
    currentPeriodEnd,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashed = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      password: hashed,
      name: dto.name,
    });

    return this.buildAuthResponse(toSafeUser(user));
  }

  async validateUser(email: string, password: string): Promise<SafeUser> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return toSafeUser(user);
  }

  async login(user: SafeUser) {
    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: SafeUser) {
    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });
    return { user, accessToken };
  }
}
