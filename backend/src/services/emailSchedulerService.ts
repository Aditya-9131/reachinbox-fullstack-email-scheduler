import { prisma } from '../config/database';
import { addEmailJob, cancelEmailJob, emailQueue } from '../queues/emailQueue';
import { elasticsearchService, EmailDocument } from './elasticsearchService';
import { logger } from '../config/logger';

export interface ScheduleEmailInput {
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string | Date;
  delaySeconds?: number;
  hourlyLimit?: number;
  campaignId?: string | null;
  userId?: string | null;
}

export interface ScheduleBatchInput {
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  scheduledAt: string | Date;
  delaySeconds?: number;
  hourlyLimit?: number;
  campaignName?: string;
  userId?: string | null;
}

export class EmailSchedulerService {
  /**
   * Schedule a single email
   */
  async scheduleEmail(input: ScheduleEmailInput) {
    const scheduledDate = new Date(input.scheduledAt);
    const now = Date.now();
    const delayMs = Math.max(0, scheduledDate.getTime() - now);
    const delaySeconds = input.delaySeconds ?? 2;
    const hourlyLimit = input.hourlyLimit ?? 50;

    // 1. Create DB record
    const emailJob = await prisma.emailJob.create({
      data: {
        sender: input.sender,
        recipient: input.recipient,
        subject: input.subject,
        body: input.body,
        status: 'SCHEDULED',
        scheduledAt: scheduledDate,
        delaySeconds,
        hourlyLimit,
        campaignId: input.campaignId,
        userId: input.userId,
      },
    });

    // 2. Add delayed job to BullMQ
    await addEmailJob(
      {
        emailId: emailJob.id,
        recipient: emailJob.recipient,
        sender: emailJob.sender,
        subject: emailJob.subject,
        body: emailJob.body,
        scheduledAt: scheduledDate.toISOString(),
        delaySeconds,
        hourlyLimit,
        campaignId: input.campaignId,
        userId: input.userId,
      },
      delayMs
    );

    // 3. Index in Elasticsearch
    await elasticsearchService.indexEmail({
      id: emailJob.id,
      recipient: emailJob.recipient,
      sender: emailJob.sender,
      subject: emailJob.subject,
      body: emailJob.body,
      status: emailJob.status,
      scheduledAt: emailJob.scheduledAt,
      userId: emailJob.userId,
      campaignId: emailJob.campaignId,
      createdAt: emailJob.createdAt,
    });

    logger.info(`✅ Scheduled email [${emailJob.id}] to ${emailJob.recipient} at ${scheduledDate.toISOString()}`);
    return emailJob;
  }

  /**
   * Schedule a batch of leads (e.g. from CSV upload) with staggered delays
   */
  async scheduleBatch(input: ScheduleBatchInput) {
    const { recipients, sender, subject, body, scheduledAt, delaySeconds = 2, hourlyLimit = 50, campaignName, userId } = input;
    const startDate = new Date(scheduledAt);
    const baseTimestamp = startDate.getTime();
    const now = Date.now();
    const baseDelayMs = Math.max(0, baseTimestamp - now);

    // 1. Create Campaign record if needed
    let campaign = null;
    if (campaignName || recipients.length > 1) {
      campaign = await prisma.campaign.create({
        data: {
          name: campaignName || `Campaign - ${new Date().toLocaleDateString()}`,
          senderEmail: sender,
          totalLeads: recipients.length,
          userId: userId || null,
        },
      });
    }

    const createdJobs: any[] = [];
    const esDocuments: EmailDocument[] = [];

    // 2. Create DB records and enqueue staggered BullMQ jobs
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i].trim();
      if (!recipient) continue;

      // Stagger each recipient by delaySeconds
      const leadDelayMs = baseDelayMs + i * (delaySeconds * 1000);
      const leadScheduledAt = new Date(baseTimestamp + i * (delaySeconds * 1000));

      const jobRecord = await prisma.emailJob.create({
        data: {
          sender,
          recipient,
          subject,
          body,
          status: 'SCHEDULED',
          scheduledAt: leadScheduledAt,
          delaySeconds,
          hourlyLimit,
          campaignId: campaign ? campaign.id : null,
          userId: userId || null,
        },
      });

      // Add delayed job to BullMQ
      await addEmailJob(
        {
          emailId: jobRecord.id,
          recipient: jobRecord.recipient,
          sender: jobRecord.sender,
          subject: jobRecord.subject,
          body: jobRecord.body,
          scheduledAt: leadScheduledAt.toISOString(),
          delaySeconds,
          hourlyLimit,
          campaignId: campaign ? campaign.id : null,
          userId: userId || null,
        },
        leadDelayMs
      );

      createdJobs.push(jobRecord);
      esDocuments.push({
        id: jobRecord.id,
        recipient: jobRecord.recipient,
        sender: jobRecord.sender,
        subject: jobRecord.subject,
        body: jobRecord.body,
        status: jobRecord.status,
        scheduledAt: jobRecord.scheduledAt,
        userId: jobRecord.userId,
        campaignId: jobRecord.campaignId,
        createdAt: jobRecord.createdAt,
      });
    }

    // 3. Bulk index in Elasticsearch
    await elasticsearchService.bulkIndexEmails(esDocuments);

    logger.info(`✅ Successfully scheduled batch of ${createdJobs.length} emails starting at ${startDate.toISOString()}`);

    return {
      campaign,
      totalScheduled: createdJobs.length,
      firstScheduledAt: startDate,
      jobs: createdJobs,
    };
  }

  /**
   * Get scheduled emails list
   */
  async getScheduledEmails(params: { page?: number; limit?: number; sender?: string; query?: string }) {
    const { page = 1, limit = 20, sender, query } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      status: { in: ['SCHEDULED', 'RATE_LIMITED_RESCHEDULED', 'PROCESSING'] },
    };

    if (sender) where.sender = sender;
    if (query) {
      where.OR = [
        { recipient: { contains: query } },
        { subject: { contains: query } },
        { sender: { contains: query } },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  /**
   * Get sent emails list
   */
  async getSentEmails(params: { page?: number; limit?: number; sender?: string; query?: string }) {
    const { page = 1, limit = 20, sender, query } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      status: { in: ['SENT', 'FAILED'] },
    };

    if (sender) where.sender = sender;
    if (query) {
      where.OR = [
        { recipient: { contains: query } },
        { subject: { contains: query } },
        { sender: { contains: query } },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  /**
   * Cancel a scheduled email
   */
  async cancelEmail(emailId: string) {
    await cancelEmailJob(emailId);

    const updated = await prisma.emailJob.update({
      where: { id: emailId },
      data: { status: 'CANCELLED' },
    });

    await elasticsearchService.updateEmail(emailId, { status: 'CANCELLED' });
    return updated;
  }

  /**
   * Startup sync & recovery: ensures future scheduled emails in DB survive restart
   */
  async syncPendingJobsOnStartup() {
    try {
      const pendingJobs = await prisma.emailJob.findMany({
        where: {
          status: { in: ['SCHEDULED', 'RATE_LIMITED_RESCHEDULED', 'PROCESSING'] },
        },
      });

      logger.info(`🔍 Checking ${pendingJobs.length} active/scheduled emails on startup for restart resilience...`);

      let recoveredCount = 0;
      for (const job of pendingJobs) {
        const jobId = `email_${job.id}`;
        const existingBullJob = await emailQueue.getJob(jobId);

        if (!existingBullJob) {
          const now = Date.now();
          const targetTime = new Date(job.scheduledAt).getTime();
          const delayMs = Math.max(0, targetTime - now);

          await addEmailJob(
            {
              emailId: job.id,
              recipient: job.recipient,
              sender: job.sender,
              subject: job.subject,
              body: job.body,
              scheduledAt: job.scheduledAt.toISOString(),
              delaySeconds: job.delaySeconds,
              hourlyLimit: job.hourlyLimit,
              campaignId: job.campaignId,
              userId: job.userId,
            },
            delayMs,
            jobId
          );
          recoveredCount++;
        }
      }

      if (recoveredCount > 0) {
        logger.info(`♻️ Successfully re-queued ${recoveredCount} pending emails after restart`);
      } else {
        logger.info(`✨ All pending jobs are already safely persisted in BullMQ Redis store`);
      }
    } catch (error: any) {
      logger.error('Error during startup job recovery:', error);
    }
  }
}

export const emailSchedulerService = new EmailSchedulerService();
