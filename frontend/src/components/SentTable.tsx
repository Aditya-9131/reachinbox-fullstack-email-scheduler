import React from 'react';
import { EmailJob } from '../types';
import { Send, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface SentTableProps {
  emails: EmailJob[];
  loading: boolean;
  onOpenCompose: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  loading,
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
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
          <Send className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-slate-200">No sent emails yet</h4>
          <p className="text-xs text-slate-400 max-w-sm">
            Once BullMQ workers process your scheduled email jobs, delivered emails and their Ethereal test inbox previews will appear here.
          </p>
        </div>
        <button
          onClick={onOpenCompose}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
        >
          Send Your First Email
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Recipient</th>
              <th className="py-3.5 px-4">Subject</th>
              <th className="py-3.5 px-4">Sender</th>
              <th className="py-3.5 px-4">Delivered At</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {emails.map((email) => {
              const sentDate = email.sentAt ? new Date(email.sentAt) : new Date(email.updatedAt || email.createdAt);

              return (
                <tr key={email.id} className="hover:bg-slate-800/40 transition-colors">
                  {/* Recipient */}
                  <td className="py-3.5 px-4 font-medium text-slate-200">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>{email.recipient}</span>
                    </div>
                  </td>

                  {/* Subject with highlights */}
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

                  {/* Delivered Timestamp */}
                  <td className="py-3.5 px-4 text-slate-300">
                    <span className="font-medium text-slate-200">
                      {format(sentDate, 'MMM d, yyyy · HH:mm:ss')}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4">
                    {email.status === 'SENT' ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span>Delivered</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[11px] font-medium" title={email.errorMessage || ''}>
                        <XCircle className="w-3 h-3 text-rose-400" />
                        <span>Failed</span>
                      </span>
                    )}
                  </td>

                  {/* Ethereal Mailbox Preview Link */}
                  <td className="py-3.5 px-4 text-right">
                    {email.etherealPreviewUrl ? (
                      <a
                        href={email.etherealPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[11px] font-medium border border-blue-500/20 transition-colors"
                        title="Open fake SMTP message in Ethereal web inbox"
                      >
                        <span>View Email</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Direct SMTP</span>
                    )}
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
