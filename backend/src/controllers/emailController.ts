import { Request, Response } from 'express';
import { emailSchedulerService } from '../services/emailSchedulerService';
import { elasticsearchService } from '../services/elasticsearchService';
import { parseLeadsFile } from '../utils/csvParser';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export class EmailController {
  /**
   * Schedule a single email or batch of emails
   * POST /api/emails/schedule
   */
  async schedule(req: Request, res: Response) {
    try {
      const {
        sender,
        recipient,
        recipients,
        subject,
        body,
        scheduledAt,
        delaySeconds,
        hourlyLimit,
        campaignName,
      } = req.body;

      const userId = (req as any).user?.id || 'demo-user-id';

      if (!sender || !subject || !body || !scheduledAt) {
        return res.status(400).json({
          error: 'Missing required fields: sender, subject, body, and scheduledAt are mandatory.',
        });
      }

      // 1. Batch scheduling
      if (Array.isArray(recipients) && recipients.length > 0) {
        const result = await emailSchedulerService.scheduleBatch({
          sender,
          recipients,
          subject,
          body,
          scheduledAt,
          delaySeconds: Number(delaySeconds) || 2,
          hourlyLimit: Number(hourlyLimit) || 50,
          campaignName,
          userId,
        });

        return res.status(201).json({
          success: true,
          message: `Successfully scheduled ${result.totalScheduled} emails.`,
          data: result,
        });
      }

      // 2. Single email scheduling
      if (!recipient) {
        return res.status(400).json({ error: 'Please provide either recipient or recipients array.' });
      }

      const emailJob = await emailSchedulerService.scheduleEmail({
        sender,
        recipient,
        subject,
        body,
        scheduledAt,
        delaySeconds: Number(delaySeconds) || 2,
        hourlyLimit: Number(hourlyLimit) || 50,
        userId,
      });

      return res.status(201).json({
        success: true,
        message: 'Email scheduled successfully.',
        data: emailJob,
      });
    } catch (error: any) {
      logger.error('Error scheduling email:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }

  /**
   * Parse uploaded CSV or TXT lead file
   * POST /api/emails/parse-leads
   */
  async parseLeads(req: Request, res: Response) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const parsed = parseLeadsFile(file.buffer, file.originalname);
      return res.json({
        success: true,
        fileName: file.originalname,
        count: parsed.emails.length,
        emails: parsed.emails,
        leads: parsed.leads.slice(0, 100), // Preview top 100
      });
    } catch (error: any) {
      logger.error('Error parsing leads file:', error);
      return res.status(500).json({ error: error.message || 'Failed to parse file.' });
    }
  }

  /**
   * Get scheduled emails
   * GET /api/emails/scheduled
   */
  async getScheduled(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const sender = req.query.sender as string;
      const query = req.query.query as string;

      const result = await emailSchedulerService.getScheduledEmails({ page, limit, sender, query });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      logger.error('Error getting scheduled emails:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get sent emails
   * GET /api/emails/sent
   */
  async getSent(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const sender = req.query.sender as string;
      const query = req.query.query as string;

      const result = await emailSchedulerService.getSentEmails({ page, limit, sender, query });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      logger.error('Error getting sent emails:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Search emails across Elasticsearch (with DB fallback)
   * GET /api/emails/search
   */
  async search(req: Request, res: Response) {
    try {
      const query = (req.query.q as string) || '';
      const status = req.query.status as string;
      const sender = req.query.sender as string;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await elasticsearchService.searchEmails({
        query,
        status,
        sender,
        page,
        limit,
      });

      return res.json({ success: true, ...result });
    } catch (error: any) {
      logger.error('Error searching emails:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Cancel scheduled email
   * DELETE /api/emails/:id
   */
  async cancel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const email = await emailSchedulerService.cancelEmail(id);
      return res.json({ success: true, message: 'Email cancelled successfully.', data: email });
    } catch (error: any) {
      logger.error('Error cancelling email:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get single email details
   * GET /api/emails/:id
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const email = await prisma.emailJob.findUnique({ where: { id } });
      if (!email) {
        return res.status(400).json({ error: 'Email not found.' });
      }
      return res.json({ success: true, data: email });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export const emailController = new EmailController();
