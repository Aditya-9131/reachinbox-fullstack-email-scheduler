import { Router } from 'express';
import { slackController } from '../controllers/slackController';

export const slackRoutes = Router();

slackRoutes.get('/oauth/start', (req, res) => slackController.startOAuth(req, res));
slackRoutes.get('/oauth/callback', (req, res) => slackController.handleCallback(req, res));
slackRoutes.post('/webhook', (req, res) => slackController.saveWebhook(req, res));
slackRoutes.get('/status', (req, res) => slackController.getStatus(req, res));
slackRoutes.post('/test', (req, res) => slackController.sendTest(req, res));
slackRoutes.post('/disconnect', (req, res) => slackController.disconnect(req, res));
