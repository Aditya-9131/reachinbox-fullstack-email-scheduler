import React from 'react';
import { DashboardStats } from '../types';
import { Calendar, Send, ShieldAlert, Cpu, Database, CheckCircle2 } from 'lucide-react';

interface StatsCardsProps {
  stats: DashboardStats | null;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Scheduled */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800/80 hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Scheduled Emails</span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white tracking-tight">{stats.scheduledCount}</span>
          <span className="text-xs text-slate-400 font-medium">pending dispatch</span>
        </div>
        <div className="mt-3 flex items-center space-x-1.5 text-[11px] text-blue-400/90 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span>BullMQ Delayed Queue: {stats.queueCounts?.delayed || 0} jobs</span>
        </div>
      </div>

      {/* Total Sent */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800/80 hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Sent & Delivered</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Send className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white tracking-tight">{stats.sentCount}</span>
          <span className="text-xs text-emerald-400 font-medium">({stats.successRate}% success)</span>
        </div>
        <div className="mt-3 flex items-center space-x-1.5 text-[11px] text-emerald-400 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Ethereal SMTP Active</span>
        </div>
      </div>

      {/* Rate Limits & Auto-Rescheduling */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800/80 hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Rate Limit Defenses</span>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white tracking-tight">
            {stats.rateLimitInfo?.hourlyLimitPerSender || 50}
          </span>
          <span className="text-xs text-slate-400 font-medium">emails / hr per sender</span>
        </div>
        <div className="mt-3 text-[11px] text-amber-400 font-medium flex items-center justify-between">
          <span>Rescheduled: {stats.rescheduledCount || 0}</span>
          <span>Throttle: {stats.rateLimitInfo?.delayBetweenSendsSeconds || 2}s delay</span>
        </div>
      </div>

      {/* Engine & Concurrency */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800/80 hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Worker Pool & Index</span>
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
            <Cpu className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white tracking-tight">
            {stats.rateLimitInfo?.workerConcurrency || 5}
          </span>
          <span className="text-xs text-slate-400 font-medium">parallel workers</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-purple-400 font-medium">
          <span className="flex items-center space-x-1">
            <Database className="w-3 h-3" />
            <span>Elasticsearch Search</span>
          </span>
          <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
            {stats.rateLimitInfo?.elasticsearchHealthy ? 'Indexed' : 'DB Ready'}
          </span>
        </div>
      </div>
    </div>
  );
};
