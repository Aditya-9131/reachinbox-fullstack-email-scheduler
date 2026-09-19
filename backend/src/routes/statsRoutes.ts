import { Router } from 'express';
import { statsController } from '../controllers/statsController';

export const statsRoutes = Router();

statsRoutes.get('/overview', (req, res) => statsController.getOverview(req, res));
statsRoutes.get('/sender/:email', (req, res) => statsController.getSenderQuota(req, res));
