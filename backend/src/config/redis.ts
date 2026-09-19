import Redis, { RedisOptions } from 'ioredis';
import { config } from './env';
import { logger } from './logger';

export const redisConnectionOptions: RedisOptions = config.REDIS_URL
  ? {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    }
  : {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    };

export const createRedisClient = (): Redis => {
  const client = config.REDIS_URL
    ? new Redis(config.REDIS_URL, redisConnectionOptions)
    : new Redis(redisConnectionOptions);

  client.on('connect', () => {
    logger.info(`✅ Connected to Redis (${config.REDIS_URL ? 'via URL' : `${config.REDIS_HOST}:${config.REDIS_PORT}`})`);
  });

  client.on('error', (err) => {
    logger.error('❌ Redis Connection Error:', { message: err.message });
  });

  return client;
};

export const redisClient = createRedisClient();
