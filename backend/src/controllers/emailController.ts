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

  /**
   * Render Ethereal-style Web Message Preview
   * GET /api/emails/:id/preview
   */
  async getPreview(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const email = await prisma.emailJob.findUnique({ where: { id } });
      if (!email) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Email Not Found - ReachInbox</title><style>body{font-family:sans-serif;background:#0b0f17;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style></head>
            <body><div style="text-align:center;"><h2>Email Not Found</h2><p>The requested email record does not exist.</p></div></body>
          </html>
        `);
      }

      const formattedDate = email.sentAt ? new Date(email.sentAt).toUTCString() : new Date(email.createdAt).toUTCString();
      const bodyContent = email.body || '';

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${email.subject} - ReachInbox Ethereal Web Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0b0f17] text-slate-100 min-h-screen p-4 md:p-8 font-sans">
  <div class="max-w-4xl mx-auto space-y-4">
    <!-- Header Banner -->
    <div class="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-lg">
          R
        </div>
        <div>
          <h1 class="text-lg font-bold text-white tracking-tight">ReachInbox Fake SMTP Web Viewer</h1>
          <p class="text-xs text-slate-400">Delivered message test preview</p>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <span class="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-full flex items-center space-x-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Delivered (${email.status})</span>
        </span>
        <span class="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs rounded-lg font-mono">${email.messageId || 'msg_' + email.id.slice(0, 8)}</span>
      </div>
    </div>

    <!-- Envelope Details -->
    <div class="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3 text-xs">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b border-slate-800">
        <div>
          <span class="text-slate-400 block mb-0.5 font-medium">From:</span>
          <span class="text-white font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800 inline-block">${email.sender}</span>
        </div>
        <div>
          <span class="text-slate-400 block mb-0.5 font-medium">To:</span>
          <span class="text-white font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800 inline-block">${email.recipient}</span>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <span class="text-slate-400 block mb-0.5 font-medium">Subject:</span>
          <span class="text-slate-100 font-semibold text-sm">${email.subject}</span>
        </div>
        <div>
          <span class="text-slate-400 block mb-0.5 font-medium">Delivered Timestamp:</span>
          <span class="text-slate-300 font-mono">${formattedDate}</span>
        </div>
      </div>
    </div>

    <!-- Rendered Body -->
    <div class="bg-[#0f172a] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      <div class="bg-slate-900 px-6 py-3 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-300">
        <span>Rendered HTML Content</span>
        <span class="text-[11px] text-slate-400">MIME Type: text/html</span>
      </div>
      <div class="p-6 md:p-8 bg-white text-slate-900 min-h-[250px] leading-relaxed">
        ${bodyContent.startsWith('<') ? bodyContent : '<p style="white-space: pre-wrap; font-family: sans-serif; font-size: 14px; line-height: 1.6;">' + bodyContent + '</p>'}
      </div>
    </div>
  </div>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (error: any) {
      return res.status(500).send('Error rendering email preview: ' + error.message);
    }
  }
}

export const emailController = new EmailController();
