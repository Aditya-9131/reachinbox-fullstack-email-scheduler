import { Router } from 'express';
import { emailRoutes } from './emailRoutes';
import { authRoutes } from './authRoutes';
import { slackRoutes } from './slackRoutes';
import { statsRoutes } from './statsRoutes';

export const apiRouter = Router();

apiRouter.use('/emails', emailRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/slack', slackRoutes);
apiRouter.use('/stats', statsRoutes);

apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'ReachInbox Email Scheduler Backend',
  });
});
