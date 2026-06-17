import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { ClipsModule } from './clips/clips.module';
import { HealthModule } from './health/health.module';
import { BillingModule } from './billing/billing.module';
import { AdsModule } from './ads/ads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    StorageModule,
    QueueModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    ClipsModule,
    HealthModule,
    BillingModule,
    AdsModule,
  ],
})
export class AppModule {}
