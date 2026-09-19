import { WebClient } from '@slack/web-api';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { logger } from '../config/logger';

interface SlackAlertParams {
  userId?: string | null;
  senderEmail: string;
  hourlyLimit: number;
  currentCount: number;
  rescheduledCount?: number;
  nextAvailableWindow: Date;
}

class SlackService {
  /**
   * Get authorization URL for Slack OAuth 2.0
   */
  getOAuthUrl(userId?: string): string {
    const clientId = config.SLACK_CLIENT_ID;
    const redirectUri = encodeURIComponent(config.SLACK_REDIRECT_URI);
    const scope = encodeURIComponent('incoming-webhook,chat:write,chat:write.public');
    const state = userId || 'default_user';

    return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;
  }

  /**
   * Exchange Slack OAuth code for access token & incoming webhook
   */
  async handleOAuthCallback(code: string, userId?: string) {
    try {
      const client = new WebClient();
      const response = await client.oauth.v2.access({
        client_id: config.SLACK_CLIENT_ID,
        client_secret: config.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: config.SLACK_REDIRECT_URI,
      });

      if (!response.ok) {
        throw new Error(response.error || 'Slack OAuth exchange failed');
      }

      const teamName = response.team?.name || 'Slack Workspace';
      const teamId = response.team?.id || '';
      const webhookUrl = (response.incoming_webhook as any)?.url || '';
      const channel = (response.incoming_webhook as any)?.channel || '';
      const accessToken = response.access_token || '';

      const effectiveUserId = userId || 'default_user';

      const slackConfig = await prisma.slackConfig.upsert({
        where: { userId: effectiveUserId },
        update: {
          teamName,
          teamId,
          channel,
          webhookUrl,
          accessToken,
          isConnected: true,
        },
        create: {
          userId: effectiveUserId,
          teamName,
          teamId,
          channel,
          webhookUrl,
          accessToken,
          isConnected: true,
        },
      });

      logger.info(`✅ Slack connected for user ${effectiveUserId}: ${teamName} (${channel})`);
      return slackConfig;
    } catch (error: any) {
      logger.error('❌ Slack OAuth callback error:', error);
      throw error;
    }
  }

  /**
   * Configure custom Slack webhook URL (useful for direct testing & local setups)
   */
  async saveCustomWebhook(userId: string, webhookUrl: string, channel: string = '#general') {
    const effectiveUserId = userId || 'default_user';
    const slackConfig = await prisma.slackConfig.upsert({
      where: { userId: effectiveUserId },
      update: {
        webhookUrl,
        channel,
        teamName: 'Custom Webhook Integration',
        isConnected: true,
      },
      create: {
        userId: effectiveUserId,
        webhookUrl,
        channel,
        teamName: 'Custom Webhook Integration',
        isConnected: true,
      },
    });

    logger.info(`✅ Saved custom Slack webhook for user ${effectiveUserId}`);
    return slackConfig;
  }

  /**
   * Get active Slack configuration for user
   */
  async getSlackConfig(userId?: string | null) {
    const effectiveUserId = userId || 'default_user';
    
    // Check user config first
    let userConfig = await prisma.slackConfig.findFirst({
      where: {
        OR: [
          { userId: effectiveUserId },
          { isConnected: true }
        ]
      }
    });

    if (userConfig && userConfig.isConnected) {
      return userConfig;
    }

    // Fallback to env default webhook if present
    if (config.DEFAULT_SLACK_WEBHOOK_URL) {
      return {
        isConnected: true,
        webhookUrl: config.DEFAULT_SLACK_WEBHOOK_URL,
        teamName: 'Default Workspace (Env)',
        channel: '#email-alerts',
        accessToken: null,
      };
    }

    return null;
  }

  /**
   * Disconnect Slack integration
   */
  async disconnect(userId?: string | null) {
    const effectiveUserId = userId || 'default_user';
    await prisma.slackConfig.updateMany({
      where: { userId: effectiveUserId },
      data: { isConnected: false },
    });
    logger.info(`🔌 Slack disconnected for user ${effectiveUserId}`);
    return { success: true };
  }

  /**
   * Send live Slack message via Webhook or Slack WebClient
   */
  private async postMessage(webhookUrl: string | null, accessToken: string | null, channel: string | null, payload: any) {
    // 1. Try incoming webhook
    if (webhookUrl) {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Slack webhook responded with status ${response.status}: ${text}`);
      }
      return true;
    }

    // 2. Try Slack WebClient with token
    if (accessToken && channel) {
      const client = new WebClient(accessToken);
      await client.chat.postMessage({
        channel,
        ...payload,
      });
      return true;
    }

    throw new Error('No valid webhook URL or access token available');
  }

  /**
   * Send Rate Limit Hit notification to Slack
   */
  async sendRateLimitAlert(params: SlackAlertParams): Promise<boolean> {
    try {
      const slackConfig = await this.getSlackConfig(params.userId);
      if (!slackConfig || !slackConfig.isConnected) {
        logger.info(`ℹ️ Rate limit reached for ${params.senderEmail}, but Slack is not connected. Skipping notification.`);
        return false;
      }

      const formattedTime = params.nextAvailableWindow.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const payload = {
        text: `🚨 *ReachInbox Rate Limit Alert:* Sender \`${params.senderEmail}\` has hit the hourly rate limit of *${params.hourlyLimit} emails/hour*.`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚨 ReachInbox Scheduler: Rate Limit Exceeded',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Sender:*\n\`${params.senderEmail}\``,
              },
              {
                type: 'mrkdwn',
                text: `*Hourly Limit:*\n${params.hourlyLimit} emails/hr`,
              },
              {
                type: 'mrkdwn',
                text: `*Current Attempts:*\n${params.currentCount} emails`,
              },
              {
                type: 'mrkdwn',
                text: `*Next Sending Window:*\n${formattedTime}`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `⚠️ *Automatic Action:* Remaining jobs are being deferred and rescheduled to the next available hour window to preserve sender domain reputation.`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `📅 Timestamp: ${new Date().toISOString()} | ReachInbox Job Scheduler`,
              },
            ],
          },
        ],
      };

      await this.postMessage(slackConfig.webhookUrl, slackConfig.accessToken, slackConfig.channel, payload);
      logger.info(`📢 Live Slack Rate Limit notification dispatched for ${params.senderEmail}`);
      return true;
    } catch (error: any) {
      logger.error('❌ Failed to send Slack rate limit alert:', { message: error.message });
      return false;
    }
  }

  /**
   * Send Test Notification to verify integration
   */
  async sendTestNotification(userId?: string | null): Promise<{ success: boolean; message: string }> {
    try {
      const slackConfig = await this.getSlackConfig(userId);
      if (!slackConfig || !slackConfig.isConnected) {
        return { success: false, message: 'Slack is not connected. Please connect Slack first.' };
      }

      const payload = {
        text: '🚀 *ReachInbox Notification:* Slack connection verified successfully!',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚀 ReachInbox Email Scheduler',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *Slack Integration Verified!*\nYour ReachInbox email scheduler is connected to Slack. You will receive live alerts when hourly rate limits are reached or when campaigns finish.`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Connected workspace: *${slackConfig.teamName || 'Active'}* | Channel: \`${slackConfig.channel || '#general'}\``,
              },
            ],
          },
        ],
      };

      await this.postMessage(slackConfig.webhookUrl, slackConfig.accessToken, slackConfig.channel, payload);
      return { success: true, message: 'Test notification sent to Slack successfully!' };
    } catch (error: any) {
      return { success: false, message: `Failed to send test notification: ${error.message}` };
    }
  }
}

export const slackService = new SlackService();
