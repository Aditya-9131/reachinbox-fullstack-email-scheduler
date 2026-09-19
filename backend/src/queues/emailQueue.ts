import { Queue, JobsOptions } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';
import { logger } from '../config/logger';

export const EMAIL_QUEUE_NAME = 'email-queue';

export interface EmailJobPayload {
  emailId: string;
  recipient: string;
  sender: string;
  subject: string;
  body: string;
  scheduledAt: string; // ISO string
  delaySeconds: number;
  hourlyLimit: number;
  campaignId?: string | null;
  userId?: string | null;
}

export let emailQueue: Queue<EmailJobPayload>;

export const initEmailQueue = () => {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
      connection: redisConnectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          count: 1000,
        },
        removeOnFail: {
          count: 1000,
        },
      },
    });

    emailQueue.on('error', (err) => {
      logger.error('❌ BullMQ Queue Error:', { message: err.message });
    });
  }
  return emailQueue;
};

/**
 * Add a single delayed email job to BullMQ
 */
export const addEmailJob = async (
  payload: EmailJobPayload,
  delayMs: number = 0,
  customJobId?: string
) => {
  const queue = emailQueue || initEmailQueue();
  const jobId = customJobId || `email_${payload.emailId}`;

  const options: JobsOptions = {
    jobId,
    delay: Math.max(0, delayMs),
  };

  const job = await queue.add('send-email', payload, options);
  logger.info(
    `📥 Enqueued Email Job [${job.id}] for ${payload.recipient} | Scheduled delay: ${Math.round(
      delayMs / 1000
    )}s`
  );
  return job;
};

/**
 * Cancel/remove a scheduled email job from BullMQ
 */
export const cancelEmailJob = async (emailId: string): Promise<boolean> => {
  const queue = emailQueue || initEmailQueue();
  const jobId = `email_${emailId}`;
  const job = await queue.getJob(jobId);
  if (job) {
    await job.remove();
    logger.info(`🗑️ Removed job ${jobId} from BullMQ queue`);
    return true;
  }
  return false;
};
