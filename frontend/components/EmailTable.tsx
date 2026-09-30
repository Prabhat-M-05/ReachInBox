'use client';

import React from 'react';
import { EmailItem } from '@/lib/api';
import { Clock, CheckCircle2, AlertCircle, Send, FileText, ShieldAlert, Loader2 } from 'lucide-react';

interface EmailTableProps {
  emails: EmailItem[];
  loading: boolean;
}

export const EmailTable: React.FC<EmailTableProps> = ({ emails, loading }) => {
  const getStatusBadge = (status: EmailItem['status']) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            <CheckCircle2 className="w-3 h-3" /> SENT
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-400 border border-amber-800/60">
            <Clock className="w-3 h-3" /> SCHEDULED
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-950/80 text-blue-400 border border-blue-800/60">
            <Loader2 className="w-3 h-3 animate-spin" /> PROCESSING
          </span>
        );
      case 'RATE_LIMITED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-950/80 text-orange-400 border border-orange-800/60">
            <ShieldAlert className="w-3 h-3" /> RATE LIMITED
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950/80 text-rose-400 border border-rose-800/60">
            <AlertCircle className="w-3 h-3" /> FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
            <Send className="w-3 h-3" /> PENDING
          </span>
        );
    }
  };

  const formatDate = (dateStr?: string | Date) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '—' : date.toLocaleString();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3.5 px-4 font-semibold">Recipient</th>
              <th className="py-3.5 px-4 font-semibold">Subject & Preview</th>
              <th className="py-3.5 px-4 font-semibold">Status</th>
              <th className="py-3.5 px-4 font-semibold">Scheduled At</th>
              <th className="py-3.5 px-4 font-semibold">Sent At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-indigo-400" />
                  Querying Elasticsearch index...
                </td>
              </tr>
            ) : emails.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No emails match your query criteria.
                </td>
              </tr>
            ) : (
              emails.map((email, idx) => {
                // Property fallbacks to handle DB and ES payload variations
                const recipient = email.recipientEmail || (email as any).recipient || '—';
                const subject = email.subject || '(No Subject)';
                const bodyText = (email.body || '').replace(/<[^>]*>/g, '');
                const scheduledDate = email.scheduledAt || (email as any).createdAt;

                return (
                  <tr key={email.id || `email-${idx}`} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-medium text-slate-200">
                      {recipient}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="font-medium text-slate-100 truncate">{subject}</p>
                      <p className="text-xs text-slate-500 truncate">{bodyText || 'No body content'}</p>
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(email.status)}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {formatDate(scheduledDate)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {formatDate(email.sentAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};