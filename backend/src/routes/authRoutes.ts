import { Router } from 'express';
import { authController } from '../controllers/authController';

export const authRoutes = Router();

authRoutes.post('/google', (req, res) => authController.verifyGoogleToken(req, res));
authRoutes.get('/me', (req, res) => authController.getMe(req, res));
