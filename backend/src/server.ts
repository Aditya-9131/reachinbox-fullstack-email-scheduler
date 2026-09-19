import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { logger } from './config/logger';
import { apiRouter } from './routes';
import { smtpService } from './services/smtpService';
import { initElasticsearch } from './config/elasticsearch';
import { setupBullBoard } from './queues/bullBoard';
import { startEmailWorker } from './queues/emailWorker';
import { emailSchedulerService } from './services/emailSchedulerService';
import { prisma } from './config/database';

const app = express();

// Middlewares
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount BullMQ Live Dashboard UI
const bullBoardRouter = setupBullBoard();
app.use('/admin/queues', bullBoardRouter);

// Mount API Routes
app.use('/api', apiRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled Express Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const startServer = async () => {
  try {
    logger.info('🚀 Initializing ReachInbox Email Scheduler Service...');

    // 1. Initialize Ethereal SMTP transporter
    await smtpService.init();

    // 2. Initialize Elasticsearch index
    await initElasticsearch();

    // 3. Start BullMQ Email Worker
    const worker = startEmailWorker();

    // 4. Synchronize pending jobs for restart persistence
    await emailSchedulerService.syncPendingJobsOnStartup();

    // 5. Start listening
    const server = app.listen(config.PORT, () => {
      logger.info(`=======================================================`);
      logger.info(`⚡ ReachInbox Backend running on http://localhost:${config.PORT}`);
      logger.info(`📊 BullMQ Queue Dashboard: http://localhost:${config.PORT}/admin/queues`);
      logger.info(`🔍 API Endpoints: http://localhost:${config.PORT}/api`);
      logger.info(`=======================================================`);
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Gracefully shutting down...`);
      await worker.close();
      await prisma.$disconnect();
      server.close(() => {
        logger.info('Server closed. Goodbye!');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error: any) {
    logger.error('Fatal startup error:', error);
    process.exit(1);
  }
};

startServer();
