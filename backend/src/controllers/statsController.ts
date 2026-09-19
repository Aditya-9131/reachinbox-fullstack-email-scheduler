import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { emailQueue } from '../queues/emailQueue';
import { RateLimiter } from '../queues/rateLimiter';
import { config } from '../config/env';
import { isElasticsearchAvailable } from '../config/elasticsearch';

export class StatsController {
  /**
   * Get comprehensive dashboard metrics
   * GET /api/stats/overview
   */
  async getOverview(req: Request, res: Response) {
    try {
      const [
        totalEmails,
        scheduledCount,
        sentCount,
        failedCount,
        rescheduledCount,
        recentActivity,
      ] = await Promise.all([
        prisma.emailJob.count(),
        prisma.emailJob.count({ where: { status: 'SCHEDULED' } }),
        prisma.emailJob.count({ where: { status: 'SENT' } }),
        prisma.emailJob.count({ where: { status: 'FAILED' } }),
        prisma.emailJob.count({ where: { status: 'RATE_LIMITED_RESCHEDULED' } }),
        prisma.emailJob.findMany({
          take: 5,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            recipient: true,
            sender: true,
            subject: true,
            status: true,
            scheduledAt: true,
            sentAt: true,
            etherealPreviewUrl: true,
          },
        }),
      ]);

      // BullMQ Queue Job Counts
      let queueCounts = {
        waiting: 0,
        delayed: 0,
        active: 0,
        completed: 0,
        failed: 0,
      };

      try {
        const counts = await emailQueue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed');
        queueCounts = {
          waiting: counts.waiting || 0,
          delayed: counts.delayed || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
        };
      } catch {
        // Redis may be syncing
      }

      // Success Rate calculation
      const processedTotal = sentCount + failedCount;
      const successRate = processedTotal > 0 ? Math.round((sentCount / processedTotal) * 100) : 100;

      // Rate limit config
      const rateLimitInfo = {
        hourlyLimitPerSender: config.MAX_EMAILS_PER_HOUR_PER_SENDER,
        delayBetweenSendsSeconds: Math.round(config.DEFAULT_DELAY_BETWEEN_EMAILS_MS / 1000),
        workerConcurrency: config.WORKER_CONCURRENCY,
        elasticsearchHealthy: isElasticsearchAvailable,
      };

      return res.json({
        success: true,
        stats: {
          totalEmails,
          scheduledCount,
          sentCount,
          failedCount,
          rescheduledCount,
          successRate,
          queueCounts,
          rateLimitInfo,
          recentActivity,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get quota usage for a specific sender
   * GET /api/stats/sender/:email
   */
  async getSenderQuota(req: Request, res: Response) {
    try {
      const senderEmail = req.params.email;
      const usage = await RateLimiter.getSenderUsage(senderEmail);

      return res.json({
        success: true,
        sender: senderEmail,
        usedThisHour: usage.count,
        maxPerHour: config.MAX_EMAILS_PER_HOUR_PER_SENDER,
        remainingThisHour: Math.max(0, config.MAX_EMAILS_PER_HOUR_PER_SENDER - usage.count),
        hourWindowKey: usage.hourKey,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export const statsController = new StatsController();
