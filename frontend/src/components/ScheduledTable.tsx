import React from 'react';
import { EmailJob } from '../types';
import { Calendar, Trash2, Clock, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ScheduledTableProps {
  emails: EmailJob[];
  loading: boolean;
  onCancel: (id: string) => void;
  onOpenCompose: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  onCancel,
  onOpenCompose,
}) => {
  if (loading) {
    return (
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-slate-800/40 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
          <Calendar className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-slate-200">No scheduled emails in queue</h4>
          <p className="text-xs text-slate-400 max-w-sm">
            Schedule a new outreach email or import a CSV lead list to see persistent BullMQ queue jobs here.
          </p>
        </div>
        <button
          onClick={onOpenCompose}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
        >
          Compose & Schedule
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: EmailJob['status']) => {
    switch (status) {
      case 'RATE_LIMITED_RESCHEDULED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[11px] font-medium">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Rate Limited (Next Window)</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[11px] font-medium">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping mr-1" />
            <span>Processing...</span>
          </span>
        );
      case 'SCHEDULED':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30 text-[11px] font-medium">
            <Clock className="w-3 h-3 text-blue-400" />
            <span>Queued</span>
          </span>
        );
    }
  };

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Recipient</th>
              <th className="py-3.5 px-4">Subject</th>
              <th className="py-3.5 px-4">Sender</th>
              <th className="py-3.5 px-4">Scheduled For</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {emails.map((email) => {
              const scheduledDate = new Date(email.scheduledAt);
              const isFuture = scheduledDate.getTime() > Date.now();

              return (
                <tr key={email.id} className="hover:bg-slate-800/40 transition-colors group">
                  {/* Recipient */}
                  <td className="py-3.5 px-4 font-medium text-slate-200">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      <span>{email.recipient}</span>
                    </div>
                  </td>

                  {/* Subject with highlights if ES matched */}
                  <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">
                    {email.highlights?.subject ? (
                      <span
                        dangerouslySetInnerHTML={{ __html: email.highlights.subject[0] }}
                      />
                    ) : (
                      email.subject
                    )}
                  </td>

                  {/* Sender */}
                  <td className="py-3.5 px-4 text-slate-400 text-[11px] font-mono">
                    {email.sender}
                  </td>

                  {/* Scheduled For */}
                  <td className="py-3.5 px-4 text-slate-300">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-200">
                        {format(scheduledDate, 'MMM d, yyyy · HH:mm:ss')}
                      </span>
                      <span className="text-[10px] text-blue-400">
                        {isFuture ? `in ${formatDistanceToNow(scheduledDate)}` : 'dispatching now'}
                      </span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4">{getStatusBadge(email.status)}</td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onCancel(email.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Cancel & remove from BullMQ queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
