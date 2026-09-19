import React from 'react';
import { useAuth } from '../context/AuthContext';
import { SlackConfig } from '../types';
import { LogOut, Activity, ExternalLink, Plus } from 'lucide-react';

interface HeaderProps {
  slackConfig: SlackConfig | null;
  onOpenSlackModal: () => void;
  onOpenComposeModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  slackConfig,
  onOpenSlackModal,
  onOpenComposeModal,
}) => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0f172a]/90 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between">
      {/* Brand & Title */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-blue-500/20 font-black text-white text-lg">
            R
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-100 tracking-tight text-base">ReachInbox</span>
              <span className="px-1.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Scheduler v2.0
              </span>
            </div>
            <span className="text-[11px] text-slate-400 block -mt-0.5">Outbox Labs AI Workflow</span>
          </div>
        </div>
      </div>

      {/* Action Controls & User Info */}
      <div className="flex items-center space-x-3.5">
        {/* Compose Button */}
        <button
          onClick={onOpenComposeModal}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs shadow-md shadow-blue-500/25 transition-all duration-200 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Compose Email</span>
        </button>

        {/* BullMQ Dashboard Link */}
        <a
          href="/admin/queues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          title="Open Live BullMQ Queue Monitor"
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>BullMQ Live Monitor</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>

        {/* Slack Status Button */}
        <button
          onClick={onOpenSlackModal}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
            slackConfig?.isConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              slackConfig?.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span>{slackConfig?.isConnected ? 'Slack Connected' : 'Connect Slack'}</span>
        </button>

        <div className="h-5 w-[1px] bg-slate-800" />

        {/* User Profile */}
        {user && (
          <div className="flex items-center space-x-3 pl-1">
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
              alt={user.name}
              className="w-8 h-8 rounded-full ring-2 ring-blue-500/30 object-cover bg-slate-800"
            />
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-200 leading-none">{user.name}</div>
              <div className="text-[11px] text-slate-400 leading-none mt-1">{user.email}</div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
