import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const allowedOrigins = new Set([
    'https://clipforge-ai-frontend.vercel.app',
    'http://localhost:3000',
  ]);
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)),
    credentials: true,
  });

  app.setGlobalPrefix('api', {
    exclude: ['health', 'system-status', 'files/(.*)'],
  });

  const port = config.get<number>('PORT', 4000);
  await app.listen(port, '0.0.0.0');
 console.log(`[API] VixClip API running on http://0.0.0.0:${port}/api`);
  console.log(`[API] Health check:   http://localhost:${port}/health`);
  console.log(`[API] System status:  http://localhost:${port}/system-status`);
}

bootstrap();
