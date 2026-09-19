export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

export interface EmailJob {
  id: string;
  recipient: string;
  sender: string;
  subject: string;
  body: string;
  status: 'PENDING' | 'SCHEDULED' | 'PROCESSING' | 'RATE_LIMITED_RESCHEDULED' | 'SENT' | 'FAILED' | 'CANCELLED';
  scheduledAt: string;
  sentAt?: string | null;
  delaySeconds: number;
  hourlyLimit: number;
  attempts: number;
  etherealPreviewUrl?: string | null;
  messageId?: string | null;
  errorMessage?: string | null;
  campaignId?: string | null;
  createdAt: string;
  updatedAt?: string;
  highlights?: {
    subject?: string[];
    body?: string[];
    recipient?: string[];
  };
  searchSource?: 'elasticsearch' | 'database';
}

export interface DashboardStats {
  totalEmails: number;
  scheduledCount: number;
  sentCount: number;
  failedCount: number;
  rescheduledCount: number;
  successRate: number;
  queueCounts: {
    waiting: number;
    delayed: number;
    active: number;
    completed: number;
    failed: number;
  };
  rateLimitInfo: {
    hourlyLimitPerSender: number;
    delayBetweenSendsSeconds: number;
    workerConcurrency: number;
    elasticsearchHealthy: boolean;
  };
  recentActivity: EmailJob[];
}

export interface SlackConfig {
  isConnected: boolean;
  teamName: string | null;
  channel: string | null;
}

export interface ParsedLead {
  email: string;
  name?: string;
  company?: string;
  [key: string]: any;
}
