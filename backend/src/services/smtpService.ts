import nodemailer from 'nodemailer';
import { config } from '../config/env';
import { logger } from '../config/logger';

interface SendMailParams {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

interface SendMailResult {
  messageId: string;
  previewUrl: string | false;
  response: string;
}

class SmtpService {
  private defaultTransporter: nodemailer.Transporter | null = null;
  private senderTransporters: Map<string, nodemailer.Transporter> = new Map();
  private isInitialized = false;

  async init(): Promise<void> {
    try {
      if (config.ETHEREAL_USER && config.ETHEREAL_PASS) {
        this.defaultTransporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: config.ETHEREAL_USER,
            pass: config.ETHEREAL_PASS,
          },
        });
        logger.info(`✅ Initialized Ethereal SMTP with user: ${config.ETHEREAL_USER}`);
      } else {
        const testAccount = await nodemailer.createTestAccount();
        this.defaultTransporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        logger.info(`✅ Generated dynamic Ethereal Test Account: ${testAccount.user}`);
      }
      this.isInitialized = true;
    } catch (error: any) {
      logger.error('❌ Failed to initialize Ethereal SMTP transporter:', error);
    }
  }

  private async getTransporterForSender(senderEmail: string): Promise<nodemailer.Transporter> {
    if (!this.isInitialized || !this.defaultTransporter) {
      await this.init();
    }

    if (this.senderTransporters.has(senderEmail)) {
      return this.senderTransporters.get(senderEmail)!;
    }

    // Use default or spawn sender-specific account
    if (this.defaultTransporter) {
      return this.defaultTransporter;
    }

    throw new Error('SMTP transporter is not initialized');
  }

  async sendEmail(params: SendMailParams): Promise<SendMailResult> {
    const transporter = await this.getTransporterForSender(params.from);

    const info = await transporter.sendMail({
      from: `"${params.from.split('@')[0]}" <${params.from}>`,
      to: params.to,
      subject: params.subject,
      text: params.text || params.html || '',
      html: params.html || `<div style="font-family: sans-serif; line-height: 1.5;">${params.text?.replace(/\n/g, '<br>') || ''}</div>`,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    logger.info(`📧 Email sent to ${params.to} from ${params.from} | Preview: ${previewUrl || 'N/A'}`);

    return {
      messageId: info.messageId,
      previewUrl: previewUrl || false,
      response: info.response,
    };
  }
}

export const smtpService = new SmtpService();
