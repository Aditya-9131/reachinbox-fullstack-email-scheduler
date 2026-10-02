import { Router } from 'express';
import { emailRoutes } from './emailRoutes';
import { authRoutes } from './authRoutes';
import { slackRoutes } from './slackRoutes';
import { statsRoutes } from './statsRoutes';
import { config } from '../config/env';

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

// Safe diagnostic: exposes SMTP mode and whether credentials are present.
// Never exposes passwords, API keys, or full email addresses.
apiRouter.get('/config', (req, res) => {
  const userSet = Boolean(config.SMTP_USER);
  const passSet = Boolean(config.SMTP_PASS);
  const fromSet = Boolean(config.SMTP_FROM);

  res.json({
    smtp: {
      mode: config.SMTP_MODE,                   // 'real' | 'ethereal' | 'fake'
      host: config.SMTP_HOST || '(not set)',
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      userConfigured: userSet,                  // true/false — does NOT show the address
      passConfigured: passSet,                  // true/false — does NOT show the password
      fromConfigured: fromSet,                  // true/false
      readyForRealDelivery:
        config.SMTP_MODE === 'real' && userSet && passSet && fromSet,
    },
  });
});
