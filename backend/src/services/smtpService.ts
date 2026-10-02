import nodemailer from 'nodemailer';
import { config } from '../config/env';
import { logger } from '../config/logger';

export interface SendMailParams {
  emailId?: string;
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | null;
  response: string;
  deliveryMode: 'REAL_SMTP' | 'ETHEREAL' | 'FAKE_SMTP';
}

export class SmtpService {
  private transporter: nodemailer.Transporter | null = null;
  private isInitialized = false;

  async init(): Promise<void> {
    try {
      if (config.SMTP_MODE === 'real') {
        if (!config.SMTP_USER || !config.SMTP_PASS) {
          throw new Error('SMTP_MODE is set to "real", but SMTP_USER or SMTP_PASS is missing in backend/.env');
        }

        this.transporter = nodemailer.createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          secure: config.SMTP_SECURE,
          auth: {
            user: config.SMTP_USER,
            pass: config.SMTP_PASS,
          },
        });
        logger.info(`✅ Initialized REAL SMTP Provider: ${config.SMTP_HOST}:${config.SMTP_PORT} (User: ${config.SMTP_USER})`);
      } else if (config.SMTP_MODE === 'ethereal') {
        if (config.ETHEREAL_USER && config.ETHEREAL_PASS) {
          this.transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            connectionTimeout: 4000,
            auth: {
              user: config.ETHEREAL_USER,
              pass: config.ETHEREAL_PASS,
            },
          });
          logger.info(`✅ Initialized Ethereal SMTP with user: ${config.ETHEREAL_USER}`);
        } else {
          const testAccount = await nodemailer.createTestAccount();
          this.transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            connectionTimeout: 4000,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });
          logger.info(`✅ Generated dynamic Ethereal Test Account: ${testAccount.user}`);
        }
      } else {
        // config.SMTP_MODE === 'fake'
        this.transporter = null;
        logger.info(`🧪 Initialized ReachInbox Local Fake SMTP Engine (Test-Only Sandbox)`);
      }
      this.isInitialized = true;
    } catch (error: any) {
      this.isInitialized = false;
      this.transporter = null;
      logger.warn(`⚠️ SMTP initialization warning: ${error.message}`);
    }
  }

  private async getTransporter(): Promise<nodemailer.Transporter | null> {
    if (!this.isInitialized) {
      await this.init();
    }
    return this.transporter;
  }

  async sendEmail(params: SendMailParams): Promise<SendMailResult> {
    // 1. REAL SMTP MODE: Strict live delivery to external inboxes
    if (config.SMTP_MODE === 'real') {
      const transporter = await this.getTransporter();
      if (!transporter) {
        throw new Error('Real SMTP transporter is not configured. Please check SMTP_HOST, SMTP_USER, and SMTP_PASS in backend/.env');
      }

      const senderFrom = config.SMTP_FROM || params.from;

      const info = await transporter.sendMail({
        from: `"${params.from.split('@')[0]}" <${senderFrom}>`,
        to: params.to,
        subject: params.subject,
        text: params.text || params.html || '',
        html: params.html || `<div style="font-family: sans-serif; line-height: 1.5;">${params.text?.replace(/\n/g, '<br>') || ''}</div>`,
      });

      logger.info(`📧 [Live SMTP Dispatched] Real email delivered to ${params.to} via ${config.SMTP_HOST} | MessageId: ${info.messageId}`);

      return {
        messageId: info.messageId,
        previewUrl: null, // Real email delivered to actual inbox; no fake preview
        response: info.response,
        deliveryMode: 'REAL_SMTP',
      };
    }

    // 2. ETHEREAL MODE: Remote Sandbox
    if (config.SMTP_MODE === 'ethereal') {
      const transporter = await this.getTransporter();
      if (transporter) {
        try {
          const info = await transporter.sendMail({
            from: `"${params.from.split('@')[0]}" <${params.from}>`,
            to: params.to,
            subject: params.subject,
            text: params.text || params.html || '',
            html: params.html || `<div style="font-family: sans-serif; line-height: 1.5;">${params.text?.replace(/\n/g, '<br>') || ''}</div>`,
          });

          const testUrl = nodemailer.getTestMessageUrl(info);
          const previewUrl = typeof testUrl === 'string' && testUrl.startsWith('http')
            ? testUrl
            : (params.emailId ? `http://localhost:5000/api/emails/${params.emailId}/preview` : null);

          logger.info(`📧 [Ethereal Sandbox] Email sent to ${params.to} | Preview: ${previewUrl || 'N/A'}`);

          return {
            messageId: info.messageId,
            previewUrl,
            response: info.response,
            deliveryMode: 'ETHEREAL',
          };
        } catch (smtpErr: any) {
          logger.warn(`⚠️ External Ethereal SMTP port timeout (${smtpErr.message}). Falling back to local fake SMTP viewer.`);
        }
      }
    }

    // 3. FAKE SMTP / LOCAL SANDBOX MODE:
    const localMessageId = `<${params.emailId || 'test_' + Date.now()}@reachinbox.test>`;
    const localPreviewUrl = params.emailId
      ? `http://localhost:5000/api/emails/${params.emailId}/preview`
      : null;

    logger.info(`🧪 [Fake SMTP - Test Only] Captured test message for ${params.to} | Preview: ${localPreviewUrl || 'N/A'}`);

    return {
      messageId: localMessageId,
      previewUrl: localPreviewUrl,
      response: '250 OK (Fake SMTP Sandbox - Not delivered to external inboxes)',
      deliveryMode: 'FAKE_SMTP',
    };
  }
}

export const smtpService = new SmtpService();

