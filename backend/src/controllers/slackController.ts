import { Request, Response } from 'express';
import { slackService } from '../services/slackService';
import { config } from '../config/env';
import { logger } from '../config/logger';

export class SlackController {
  /**
   * Start Slack OAuth flow
   * GET /api/slack/oauth/start
   */
  startOAuth(req: Request, res: Response) {
    const userId = (req as any).user?.id || 'demo-user-id';
    if (!config.SLACK_CLIENT_ID) {
      return res.status(400).json({
        error: 'Slack Client ID is not configured in backend .env. You can still configure a direct Webhook URL in the dashboard.',
      });
    }

    const authUrl = slackService.getOAuthUrl(userId);
    return res.redirect(authUrl);
  }

  /**
   * Handle Slack OAuth callback
   * GET /api/slack/oauth/callback
   */
  async handleCallback(req: Request, res: Response) {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.redirect(`${config.CLIENT_URL}/dashboard?slack_error=${encodeURIComponent(String(error))}`);
      }

      if (!code) {
        return res.redirect(`${config.CLIENT_URL}/dashboard?slack_error=missing_code`);
      }

      const userId = (state as string) || 'demo-user-id';
      await slackService.handleOAuthCallback(String(code), userId);

      return res.redirect(`${config.CLIENT_URL}/dashboard?slack_connected=true`);
    } catch (error: any) {
      logger.error('Slack OAuth callback error:', error);
      return res.redirect(`${config.CLIENT_URL}/dashboard?slack_error=${encodeURIComponent(error.message)}`);
    }
  }

  /**
   * Configure custom Slack Webhook directly
   * POST /api/slack/webhook
   */
  async saveWebhook(req: Request, res: Response) {
    try {
      const { webhookUrl, channel } = req.body;
      const userId = (req as any).user?.id || 'demo-user-id';

      if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        return res.status(400).json({
          error: 'Please provide a valid Slack Incoming Webhook URL (starts with https://hooks.slack.com/)',
        });
      }

      const slackConfig = await slackService.saveCustomWebhook(userId, webhookUrl, channel || '#general');
      return res.json({
        success: true,
        message: 'Slack Webhook connected successfully!',
        data: slackConfig,
      });
    } catch (error: any) {
      logger.error('Error saving Slack webhook:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get current Slack connection status
   * GET /api/slack/status
   */
  async getStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || 'demo-user-id';
      const slackConfig = await slackService.getSlackConfig(userId);

      return res.json({
        success: true,
        isConnected: slackConfig?.isConnected || false,
        teamName: slackConfig?.teamName || null,
        channel: slackConfig?.channel || null,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Disconnect Slack
   * POST /api/slack/disconnect
   */
  async disconnect(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || 'demo-user-id';
      await slackService.disconnect(userId);
      return res.json({ success: true, message: 'Slack integration disconnected.' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Send test Slack notification
   * POST /api/slack/test
   */
  async sendTest(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || 'demo-user-id';
      const result = await slackService.sendTestNotification(userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

export const slackController = new SlackController();
