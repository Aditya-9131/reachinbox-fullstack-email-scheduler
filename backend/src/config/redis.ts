import Redis, { RedisOptions } from 'ioredis';
import { config } from './env';
import { logger } from './logger';

let memoryServerInstance: any = null;

export const redisConnectionOptions: RedisOptions = {
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

export let redisClient: Redis;

export const initRedis = async (): Promise<Redis> => {
  if (config.REDIS_URL) {
    logger.info(`🔌 Connecting to Redis via URL...`);
    redisClient = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    return redisClient;
  }

  // Try connecting to existing local or container Redis
  try {
    const testClient = new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 2000,
      retryStrategy: () => null, // Don't hang on test
    });

    await new Promise<void>((resolve, reject) => {
      testClient.once('ready', () => {
        testClient.disconnect();
        resolve();
      });
      testClient.once('error', (err) => {
        testClient.disconnect();
        reject(err);
      });
    });

    logger.info(`✅ Connected to external Redis at ${config.REDIS_HOST}:${config.REDIS_PORT}`);
    redisClient = new Redis(redisConnectionOptions);
    return redisClient;
  } catch (err: any) {
    // If no Redis server is running locally (e.g. Docker is not installed on Windows),
    // automatically spin up embedded RedisMemoryServer for zero-friction local run!
    logger.info(`⚡ No standalone Redis found on port ${config.REDIS_PORT}. Starting Embedded In-Memory Redis Server...`);
    
    try {
      const { RedisMemoryServer } = await import('redis-memory-server');
      memoryServerInstance = new RedisMemoryServer({
        instance: {
          port: config.REDIS_PORT,
        },
      });

      let host = '127.0.0.1';
      let port = config.REDIS_PORT;

      try {
        host = await memoryServerInstance.getHost();
        port = await memoryServerInstance.getPort();
      } catch {
        // If fixed port 6379 is busy or failed, try dynamic
        memoryServerInstance = new RedisMemoryServer();
        host = await memoryServerInstance.getHost();
        port = await memoryServerInstance.getPort();
      }

      redisConnectionOptions.host = host;
      redisConnectionOptions.port = port;

      logger.info(`✅ Embedded Redis Server active on ${host}:${port}`);
      redisClient = new Redis(redisConnectionOptions);
      return redisClient;
    } catch (memErr: any) {
      logger.error('Failed to start embedded Redis:', memErr);
      // Fallback standard client
      redisClient = new Redis(redisConnectionOptions);
      return redisClient;
    }
  }
};

export const stopRedis = async () => {
  if (redisClient) {
    redisClient.disconnect();
  }
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
  }
};
