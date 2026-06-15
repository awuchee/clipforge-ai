import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private health: HealthService) {}

  /** Basic liveness/readiness check — database + Redis connectivity. */
  @Get('health')
  async health_() {
    const [database, redis] = await Promise.all([this.health.checkDatabase(), this.health.checkRedis()]);
    const healthy = database.status === 'ok' && redis.status === 'ok';

    return {
      status: healthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      database,
      redis,
    };
  }

  /** Combined view of DB, Redis, worker, and queue status. */
  @Get('system-status')
  async systemStatus() {
    return this.health.getSystemStatus();
  }
}
