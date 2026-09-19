import { redisClient } from '../config/redis';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  hourWindowKey: string;
  nextHourStart: Date;
}

export class RateLimiter {
  /**
   * Helper to generate hour window key: e.g. "2026-09-19-16"
   */
  static getHourWindowKey(date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    return `${year}-${month}-${day}-${hour}`;
  }

  /**
   * Calculate exact start timestamp of next hour window
   */
  static getNextHourStart(date: Date = new Date()): Date {
    const next = new Date(date);
    next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0);
    return next;
  }

  /**
   * Check and atomically increment hourly send count for a sender
   */
  static async checkAndIncrement(
    senderEmail: string,
    hourlyLimit: number
  ): Promise<RateLimitCheckResult> {
    const now = new Date();
    const hourKey = this.getHourWindowKey(now);
    const redisKey = `ratelimit:sender:${senderEmail}:${hourKey}`;
    const nextHourStart = this.getNextHourStart(now);

    try {
      let currentCount = 1;
      if (redisClient) {
        // Atomic increment in Redis with 2-hour TTL (7200s) to safely span boundary
        currentCount = await redisClient.incr(redisKey);
        if (currentCount === 1) {
          // Set TTL on first increment
          await redisClient.expire(redisKey, 7200);
        }
      }

      // Sync count asynchronously with DB for reporting / auditing
      prisma.senderQuota
        .upsert({
          where: {
            senderEmail_hourWindowKey: {
              senderEmail,
              hourWindowKey: hourKey,
            },
          },
          update: { count: currentCount },
          create: {
            senderEmail,
            hourWindowKey: hourKey,
            count: currentCount,
          },
        })
        .catch((err) => logger.debug(`DB Quota sync error: ${err.message}`));

      const allowed = currentCount <= hourlyLimit;

      return {
        allowed,
        currentCount,
        limit: hourlyLimit,
        hourWindowKey: hourKey,
        nextHourStart,
      };
    } catch (error: any) {
      logger.error(`Redis rate limit error for ${senderEmail}:`, error);
      // Fail-open or check in DB if Redis is temporarily unreachable
      return {
        allowed: true,
        currentCount: 1,
        limit: hourlyLimit,
        hourWindowKey: hourKey,
        nextHourStart,
      };
    }
  }

  /**
   * Get current hourly usage stats for a sender
   */
  static async getSenderUsage(senderEmail: string): Promise<{ count: number; hourKey: string }> {
    const now = new Date();
    const hourKey = this.getHourWindowKey(now);
    const redisKey = `ratelimit:sender:${senderEmail}:${hourKey}`;

    try {
      if (!redisClient) return { count: 0, hourKey };
      const countStr = await redisClient.get(redisKey);
      const count = countStr ? parseInt(countStr, 10) : 0;
      return { count, hourKey };
    } catch {
      return { count: 0, hourKey };
    }
  }
}
