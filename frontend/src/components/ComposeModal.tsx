import React, { useState } from 'react';
import { X, Send, Clock, Sparkles, AlertCircle } from 'lucide-react';
import { emailApi } from '../lib/api';
import { LeadUploader } from './LeadUploader';
import confetti from 'canvas-confetti';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_SENDERS = [
  'growth@reachinbox.ai',
  'sales@outboxlabs.com',
  'partnerships@reachinbox.io',
  'outreach@ventureleads.dev',
];

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [sender, setSender] = useState(DEFAULT_SENDERS[0]);
  const [customSender, setCustomSender] = useState('');
  const [manualRecipients, setManualRecipients] = useState('');
  const [uploadedRecipients, setUploadedRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('Transforming Your Cold Outreach with ReachInbox AI');
  const [body, setBody] = useState(
    `Hi {{name}},\n\nI came across {{company}} and was thoroughly impressed by your team's rapid growth.\n\nAt ReachInbox, we empower hyper-growth teams with AI-driven workflows to effortlessly find, enrich, and engage high-intent leads.\n\nWould you be open to a brief 10-minute coffee chat next Tuesday at 2 PM to explore potential synergies?\n\nBest regards,\nReachInbox Growth Team`
  );

  // Scheduling controls
  const [scheduleType, setScheduleType] = useState<'now' | 'scheduled'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000); // 5 mins in future default
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [campaignName, setCampaignName] = useState('Outreach Campaign Q4');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Extract combined recipients
  const manualList = manualRecipients
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.includes('@'));

  const totalRecipients = Array.from(new Set([...uploadedRecipients, ...manualList]));
  const effectiveSender = customSender.trim() || sender;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (totalRecipients.length === 0) {
      setError('Please provide at least one recipient email or upload a CSV lead list.');
      return;
    }

    if (!subject.trim()) {
      setError('Please enter an email subject.');
      return;
    }

    if (!body.trim()) {
      setError('Please enter the email body.');
      return;
    }

    setLoading(true);

    try {
      const scheduledAtDate =
        scheduleType === 'now'
          ? new Date(Date.now() + 1000).toISOString()
          : new Date(scheduledDateTime).toISOString();

      await emailApi.schedule({
        sender: effectiveSender,
        recipients: totalRecipients,
        subject,
        body,
        scheduledAt: scheduledAtDate,
        delaySeconds: Number(delaySeconds) || 2,
        hourlyLimit: Number(hourlyLimit) || 50,
        campaignName: totalRecipients.length > 1 ? campaignName : undefined,
      });

      // Confetti celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to schedule campaign. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (tag: string) => {
    setBody((prev) => prev + ` {{${tag}}}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Compose & Schedule Campaign</h3>
              <p className="text-xs text-slate-400">Powered by BullMQ Persistent Scheduler & Ethereal SMTP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Sender Account (Multi-Sender Support)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={sender}
                onChange={(e) => {
                  setSender(e.target.value);
                  setCustomSender('');
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-blue-500"
              >
                {DEFAULT_SENDERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <input
                type="email"
                value={customSender}
                onChange={(e) => setCustomSender(e.target.value)}
                placeholder="Or custom sender (e.g. you@domain.com)"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Lead Uploader */}
          <LeadUploader
            onLeadsLoaded={(emails) => setUploadedRecipients(emails)}
            recipientsCount={uploadedRecipients.length}
          />

          {totalRecipients.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Campaign Name</label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Outreach Campaign Q4"
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Manual Recipients Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Manual Recipient Emails (comma or newline separated)
              </label>
              {totalRecipients.length > 0 && (
                <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                  Total: {totalRecipients.length} lead{totalRecipients.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <textarea
              value={manualRecipients}
              onChange={(e) => setManualRecipients(e.target.value)}
              placeholder="e.g. prospect1@gmail.com, ceo@company.com"
              rows={2}
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-blue-500"
            />
          </div>

          {/* Subject Line */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter engaging email subject..."
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-blue-500"
            />
          </div>

          {/* Body with tags */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Email Body</label>
              <div className="flex items-center space-x-1.5 text-[11px]">
                <span className="text-slate-400">Insert tag:</span>
                <button
                  type="button"
                  onClick={() => insertVariable('name')}
                  className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded font-mono text-[10px]"
                >
                  &#123;&#123;name&#125;&#125;
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable('company')}
                  className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded font-mono text-[10px]"
                >
                  &#123;&#123;company&#125;&#125;
                </button>
              </div>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-blue-500 font-sans leading-relaxed"
            />
          </div>

          {/* Advanced Scheduling & Rate Limiting Controls */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Scheduling & Throttling Rules</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Zero-Cron Persistent Queue</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Start Time Type */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-medium">Start Timing</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setScheduleType('now')}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                      scheduleType === 'now'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Send Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('scheduled')}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                      scheduleType === 'scheduled'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Schedule Later
                  </button>
                </div>
              </div>

              {/* Specific Date & Time Picker */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-medium">Scheduled Start Timestamp</label>
                <input
                  type="datetime-local"
                  disabled={scheduleType === 'now'}
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className={`w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none ${
                    scheduleType === 'now' ? 'opacity-50 cursor-not-allowed' : 'focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Delay between each email */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-medium flex justify-between">
                  <span>Delay Between Emails (seconds)</span>
                  <span className="text-blue-400 font-semibold">{delaySeconds}s</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-[10px] text-slate-400 block">Staggers batch sends safely</span>
              </div>

              {/* Hourly rate limit */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-medium flex justify-between">
                  <span>Hourly Limit / Sender</span>
                  <span className="text-amber-400 font-semibold">{hourlyLimit} emails/hr</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400 block">Auto-defers excess jobs to next hour</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 flex items-center space-x-2 disabled:opacity-50 transition-all active:scale-98"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enqueuing Campaign...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    Schedule {totalRecipients.length > 0 ? `${totalRecipients.length} Email(s)` : 'Email'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
