import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkerModule } from './worker.module';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(WorkerModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const port = config.get<number>('WORKER_PORT', 4100);

  await app.listen(port);
  Logger.log(`VixClip worker running — listening for queue jobs`, 'Worker');
  Logger.log(`Worker health: http://localhost:${port}/worker-health`, 'Worker');
}

bootstrap();
