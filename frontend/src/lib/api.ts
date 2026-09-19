import axios from 'axios';
import { DashboardStats, EmailJob, SlackConfig, User } from '../types';

const API_BASE = '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const emailApi = {
  schedule: async (payload: {
    sender: string;
    recipient?: string;
    recipients?: string[];
    subject: string;
    body: string;
    scheduledAt: string;
    delaySeconds?: number;
    hourlyLimit?: number;
    campaignName?: string;
  }) => {
    const res = await apiClient.post('/emails/schedule', payload);
    return res.data;
  },

  parseLeads: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/emails/parse-leads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getScheduled: async (params?: { page?: number; limit?: number; sender?: string; query?: string }) => {
    const res = await apiClient.get<{ success: boolean; total: number; data: EmailJob[] }>('/emails/scheduled', { params });
    return res.data;
  },

  getSent: async (params?: { page?: number; limit?: number; sender?: string; query?: string }) => {
    const res = await apiClient.get<{ success: boolean; total: number; data: EmailJob[] }>('/emails/sent', { params });
    return res.data;
  },

  search: async (params: { q: string; status?: string; sender?: string; page?: number; limit?: number }) => {
    const res = await apiClient.get<{
      success: boolean;
      total: number;
      source: string;
      data: EmailJob[];
    }>('/emails/search', { params });
    return res.data;
  },

  cancel: async (id: string) => {
    const res = await apiClient.delete(`/emails/${id}`);
    return res.data;
  },
};

export const statsApi = {
  getOverview: async () => {
    const res = await apiClient.get<{ success: boolean; stats: DashboardStats }>('/stats/overview');
    return res.data.stats;
  },

  getSenderQuota: async (senderEmail: string) => {
    const res = await apiClient.get<{
      success: boolean;
      sender: string;
      usedThisHour: number;
      maxPerHour: number;
      remainingThisHour: number;
    }>(`/stats/sender/${encodeURIComponent(senderEmail)}`);
    return res.data;
  },
};

export const slackApi = {
  getStatus: async () => {
    const res = await apiClient.get<SlackConfig & { success: boolean }>('/slack/status');
    return res.data;
  },

  saveWebhook: async (webhookUrl: string, channel?: string) => {
    const res = await apiClient.post('/slack/webhook', { webhookUrl, channel });
    return res.data;
  },

  sendTest: async () => {
    const res = await apiClient.post<{ success: boolean; message: string }>('/slack/test');
    return res.data;
  },

  disconnect: async () => {
    const res = await apiClient.post('/slack/disconnect');
    return res.data;
  },
};

export const authApi = {
  verifyGoogle: async (credential: string, userInfo?: any) => {
    const res = await apiClient.post<{ success: boolean; user: User }>('/auth/google', {
      credential,
      userInfo,
    });
    return res.data.user;
  },

  getMe: async (email?: string) => {
    const res = await apiClient.get<{ success: boolean; user: User }>('/auth/me', {
      params: { email },
    });
    return res.data.user;
  },
};
