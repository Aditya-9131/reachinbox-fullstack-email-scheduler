import { Router } from 'express';
import multer from 'multer';
import { emailController } from '../controllers/emailController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file
});

export const emailRoutes = Router();

emailRoutes.post('/schedule', (req, res) => emailController.schedule(req, res));
emailRoutes.post('/parse-leads', upload.single('file'), (req, res) => emailController.parseLeads(req, res));
emailRoutes.get('/scheduled', (req, res) => emailController.getScheduled(req, res));
emailRoutes.get('/sent', (req, res) => emailController.getSent(req, res));
emailRoutes.get('/search', (req, res) => emailController.search(req, res));
emailRoutes.get('/:id', (req, res) => emailController.getById(req, res));
emailRoutes.delete('/:id', (req, res) => emailController.cancel(req, res));
