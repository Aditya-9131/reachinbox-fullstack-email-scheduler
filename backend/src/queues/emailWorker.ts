import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobPayload, emailQueue } from './emailQueue';
import { redisConnectionOptions } from '../config/redis';
import { config } from '../config/env';
import { prisma } from '../config/database';
import { smtpService } from '../services/smtpService';
import { slackService } from '../services/slackService';
import { elasticsearchService } from '../services/elasticsearchService';
import { RateLimiter } from './rateLimiter';
import { logger } from '../config/logger';

export const startEmailWorker = () => {
  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobPayload>) => {
      const { emailId, recipient, sender, subject, body, hourlyLimit, delaySeconds, userId } = job.data;
      logger.info(`⚡ Processing Email Job [${job.id}] -> Recipient: ${recipient} | Sender: ${sender}`);

      // 1. Idempotency & Database Verification
      const emailRecord = await prisma.emailJob.findUnique({
        where: { id: emailId },
      });

      if (!emailRecord) {
        logger.warn(`⚠️ Email record ${emailId} not found in DB. Skipping job.`);
        return { status: 'SKIPPED_NOT_FOUND' };
      }

      if (emailRecord.status === 'SENT') {
        logger.info(`ℹ️ Email ${emailId} was already sent. Skipping duplicate execution.`);
        return { status: 'ALREADY_SENT', previewUrl: emailRecord.etherealPreviewUrl };
      }

      if (emailRecord.status === 'CANCELLED') {
        logger.info(`ℹ️ Email ${emailId} was cancelled by user. Skipping.`);
        return { status: 'CANCELLED' };
      }

      // 2. Check Hourly Rate Limit for Sender
      const effectiveLimit = hourlyLimit || config.MAX_EMAILS_PER_HOUR_PER_SENDER;
      const rateLimitCheck = await RateLimiter.checkAndIncrement(sender, effectiveLimit);

      if (!rateLimitCheck.allowed) {
        const now = Date.now();
        const nextWindowDelayMs = Math.max(1000, rateLimitCheck.nextHourStart.getTime() - now + 2000);

        logger.warn(
          `🚨 Rate limit hit for sender '${sender}' (${rateLimitCheck.currentCount}/${effectiveLimit} emails this hour). Rescheduling to next window (${rateLimitCheck.nextHourStart.toISOString()}).`
        );

        // Update database and Elasticsearch status
        await prisma.emailJob.update({
          where: { id: emailId },
          data: {
            status: 'RATE_LIMITED_RESCHEDULED',
            scheduledAt: rateLimitCheck.nextHourStart,
            attempts: { increment: 1 },
          },
        });

        await elasticsearchService.updateEmail(emailId, {
          status: 'RATE_LIMITED_RESCHEDULED',
          scheduledAt: rateLimitCheck.nextHourStart,
        });

        // Fire live Slack rate limit alert
        await slackService.sendRateLimitAlert({
          userId,
          senderEmail: sender,
          hourlyLimit: effectiveLimit,
          currentCount: rateLimitCheck.currentCount,
          nextAvailableWindow: rateLimitCheck.nextHourStart,
        });

        // Re-enqueue job delayed to start of next hour
        await emailQueue.add('send-email', job.data, {
          delay: nextWindowDelayMs,
          jobId: `email_${emailId}_window_${rateLimitCheck.hourWindowKey}`,
        });

        return {
          status: 'RATE_LIMITED_RESCHEDULED',
          rescheduledFor: rateLimitCheck.nextHourStart,
        };
      }

      // 3. Mark as Processing
      await prisma.emailJob.update({
        where: { id: emailId },
        data: { status: 'PROCESSING' },
      });

      // 4. Mimic provider throttling delay between individual sends
      const throttleDelayMs = (delaySeconds ?? 2) * 1000;
      if (throttleDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, throttleDelayMs));
      }

      // 5. Send Email via Ethereal SMTP
      try {
        const sendResult = await smtpService.sendEmail({
          from: sender,
          to: recipient,
          subject,
          html: body,
          text: body,
        });

        const sentAt = new Date();
        const previewUrl = sendResult.previewUrl || undefined;

        // 6. Update DB record to SENT
        await prisma.emailJob.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt,
            messageId: sendResult.messageId,
            etherealPreviewUrl: previewUrl,
            attempts: { increment: 1 },
          },
        });

        // 7. Update Elasticsearch
        await elasticsearchService.updateEmail(emailId, {
          status: 'SENT',
          sentAt,
          etherealPreviewUrl: previewUrl,
        });

        logger.info(`✨ Successfully delivered email [${emailId}] to ${recipient}`);
        return {
          status: 'SENT',
          messageId: sendResult.messageId,
          previewUrl,
        };
      } catch (sendError: any) {
        logger.error(`❌ Failed to send email [${emailId}] to ${recipient}:`, sendError);

        await prisma.emailJob.update({
          where: { id: emailId },
          data: {
            status: 'FAILED',
            errorMessage: sendError.message,
            attempts: { increment: 1 },
          },
        });

        await elasticsearchService.updateEmail(emailId, {
          status: 'FAILED',
        });

        throw sendError; // Triggers BullMQ retry backoff
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency: config.WORKER_CONCURRENCY,
    }
  );

  worker.on('completed', (job) => {
    logger.info(`🎉 BullMQ Job [${job.id}] completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`💥 BullMQ Job [${job?.id}] failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error('❌ BullMQ Worker Error:', { message: err.message });
  });

  logger.info(`🚀 BullMQ Email Worker started with concurrency: ${config.WORKER_CONCURRENCY}`);
  return worker;
};
