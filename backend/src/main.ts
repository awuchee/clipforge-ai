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

  app.enableCors({
    origin: config.get<string>('FRONTEND_URL', 'http://localhost:3000'),
    credentials: true,
  });

  app.setGlobalPrefix('api', {
    exclude: ['health', 'system-status', 'files/(.*)'],
  });

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  console.log(`[API] VixClip API running on http://localhost:${port}/api`);
  console.log(`[API] Health check:   http://localhost:${port}/health`);
  console.log(`[API] System status:  http://localhost:${port}/system-status`);
}

bootstrap();
