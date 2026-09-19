import React from 'react';
import { Calendar, Send, Activity, PlusCircle, Sparkles } from 'lucide-react';

interface SidebarProps {
  activeTab: 'scheduled' | 'sent' | 'analytics';
  onSelectTab: (tab: 'scheduled' | 'sent' | 'analytics') => void;
  scheduledCount: number;
  sentCount: number;
  onOpenComposeModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  scheduledCount,
  sentCount,
  onOpenComposeModal,
}) => {
  return (
    <aside className="w-64 border-r border-slate-800/80 bg-[#0d131f] flex flex-col justify-between py-5 px-3 select-none">
      <div className="space-y-6">
        {/* Primary Action Button */}
        <div className="px-2">
          <button
            onClick={onOpenComposeModal}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium text-sm shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 transition-all transform active:scale-98"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Compose New Email</span>
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="space-y-1">
          <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Email Operations
          </div>

          <button
            onClick={() => onSelectTab('scheduled')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              activeTab === 'scheduled'
                ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Calendar className={`w-4 h-4 ${activeTab === 'scheduled' ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>Scheduled Emails</span>
            </div>
            {scheduledCount > 0 && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  activeTab === 'scheduled'
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {scheduledCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('sent')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              activeTab === 'sent'
                ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Send className={`w-4 h-4 ${activeTab === 'sent' ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>Sent Emails</span>
            </div>
            {sentCount > 0 && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  activeTab === 'sent'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {sentCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('analytics')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              activeTab === 'analytics'
                ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Activity className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>Queue & Rate Limits</span>
            </div>
          </button>
        </div>
      </div>

      {/* System Features Card */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 text-xs space-y-2">
        <div className="flex items-center space-x-2 text-blue-400 font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>BullMQ + Redis Core</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-400">
          Persistent delayed job queue with sliding window rate limiting & Slack alerts. Zero cron jobs.
        </p>
      </div>
    </aside>
  );
};
