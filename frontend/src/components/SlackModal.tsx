import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Send, Radio } from 'lucide-react';
import { SlackConfig } from '../types';
import { slackApi } from '../lib/api';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  slackConfig: SlackConfig | null;
  onStatusChange: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  slackConfig,
  onStatusChange,
}) => {
  const [activeTab, setActiveTab] = useState<'oauth' | 'webhook'>('webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState('#email-alerts');
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnectOAuth = () => {
    window.location.href = '/api/slack/oauth/start';
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await slackApi.saveWebhook(webhookUrl, channel);
      onStatusChange();
      setTestStatus({ success: true, message: 'Slack Webhook saved and active!' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save Slack webhook.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    setLoading(true);
    setTestStatus(null);
    try {
      const res = await slackApi.sendTest();
      setTestStatus(res);
    } catch (err: any) {
      setTestStatus({
        success: false,
        message: err.response?.data?.message || 'Failed to send test alert.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await slackApi.disconnect();
      onStatusChange();
      setTestStatus(null);
    } catch (err: any) {
      setError('Failed to disconnect Slack.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#4A154B] flex items-center justify-center text-white font-bold text-sm shadow">
              #
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Slack Rate Limit Alerts</h3>
              <p className="text-xs text-slate-400">Receive live notifications when hourly limits are reached</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status Banner */}
          {slackConfig?.isConnected ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Slack Integration is Active</span>
                </div>
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-medium underline"
                >
                  Disconnect
                </button>
              </div>
              <p className="text-[11px] text-slate-300">
                Workspace: <span className="text-white font-medium">{slackConfig.teamName || 'Connected'}</span> |
                Channel: <span className="font-mono text-emerald-300">{slackConfig.channel || '#general'}</span>
              </p>
              <div className="pt-2">
                <button
                  onClick={handleSendTest}
                  disabled={loading}
                  className="w-full py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{loading ? 'Sending...' : 'Send Live Test Notification to Slack'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center space-x-2 text-amber-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <span>Slack is not connected yet. Rate limit alerts will be queued silently until connected.</span>
            </div>
          )}

          {/* Test Status Feedback */}
          {testStatus && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                testStatus.success
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              }`}
            >
              {testStatus.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{testStatus.message}</span>
            </div>
          )}

          {error && <div className="p-3 bg-rose-500/10 text-rose-400 text-xs rounded-xl">{error}</div>}

          {/* Connect Methods Tabs */}
          {!slackConfig?.isConnected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('webhook')}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'webhook'
                      ? 'bg-slate-800 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Direct Webhook URL
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('oauth')}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'oauth'
                      ? 'bg-slate-800 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Slack OAuth Flow
                </button>
              </div>

              {activeTab === 'webhook' ? (
                <form onSubmit={handleSaveWebhook} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Slack Incoming Webhook URL
                    </label>
                    <input
                      type="url"
                      required
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://hooks.slack.com/services/T00/B00/XXXX"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-blue-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      Create an Incoming Webhook in your Slack workspace and paste the URL here.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Channel Name (Optional)</label>
                    <input
                      type="text"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                      placeholder="#email-alerts"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !webhookUrl}
                    className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md disabled:opacity-50 transition-all"
                  >
                    {loading ? 'Saving...' : 'Save & Activate Webhook'}
                  </button>
                </form>
              ) : (
                <div className="space-y-3 text-center py-2">
                  <p className="text-xs text-slate-400">
                    Click below to authorize ReachInbox with your Slack workspace via official OAuth 2.0.
                  </p>
                  <button
                    type="button"
                    onClick={handleConnectOAuth}
                    className="w-full py-2.5 rounded-xl bg-[#4A154B] hover:bg-[#611f69] text-white text-xs font-bold shadow-lg flex items-center justify-center space-x-2 transition-all"
                  >
                    <Radio className="w-4 h-4 text-emerald-400" />
                    <span>Authorize with Slack OAuth</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
