import { ConfigService } from '@nestjs/config';

export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
}

/** Resolves Redis connection options from REDIS_URL, or REDIS_HOST/REDIS_PORT/REDIS_PASSWORD. */
export function getRedisConnectionOptions(config: ConfigService): RedisConnectionOptions {
  const url = config.get<string>('REDIS_URL');
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 6379,
      password: parsed.password || undefined,
    };
  }

  return {
    host: config.get<string>('REDIS_HOST', '127.0.0.1'),
    port: config.get<number>('REDIS_PORT', 6379),
    password: config.get<string>('REDIS_PASSWORD') || undefined,
  };
}
