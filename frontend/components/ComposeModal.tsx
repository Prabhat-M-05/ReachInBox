'use client';

import React, { useState, useRef } from 'react';
import { X, Send, Clock, Sparkles, Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { emailApi } from '@/lib/api';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  senderId?: string;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  userId,
  senderId,
  onSuccess,
}) => {
  const [recipientInput, setRecipientInput] = useState('');
  const [parsedEmails, setParsedEmails] = useState<string[]>([]);
  const [fileDetails, setFileDetails] = useState<{ name: string; count: number } | null>(null);
  
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [delayBetweenMs, setDelayBetweenMs] = useState<number>(2000);
  const [hourlyLimit, setHourlyLimit] = useState<number>(100);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Helper to extract and validate emails from string/file text
  const extractEmails = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    return Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
  };

  // Handle CSV / Text File Upload & Parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const emailsFound = extractEmails(content);
        setParsedEmails(emailsFound);
        setFileDetails({
          name: file.name,
          count: emailsFound.length,
        });
      }
    };
    reader.readAsText(file);
  };

  const removeFile = () => {
    setParsedEmails([]);
    setFileDetails(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Direct text recipients input
      const textRecipients = extractEmails(recipientInput);

      // Merge manually typed emails with parsed CSV emails
      const finalRecipientsList = Array.from(new Set([...textRecipients, ...parsedEmails]));

      if (finalRecipientsList.length === 0) {
        throw new Error('Please enter manually typed emails or upload a CSV/text lead file.');
      }

      await emailApi.scheduleEmail({
        userId,
        senderId: senderId || userId,
        recipients: finalRecipientsList,
        recipientEmail: finalRecipientsList[0],
        subject,
        body,
        startTime: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
        delayBetweenMs: Number(delayBetweenMs),
        hourlyLimit: Number(hourlyLimit),
      } as any);

      // Reset state on success
      setRecipientInput('');
      setParsedEmails([]);
      setFileDetails(null);
      setSubject('');
      setBody('');
      setScheduledAt('');
      setDelayBetweenMs(2000);
      setHourlyLimit(100);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('API Error:', err.response?.data || err.message);
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          'Failed to schedule campaign dispatches.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Dynamic calculation for UI preview
  const manualCount = extractEmails(recipientInput).length;
  const totalCount = Array.from(new Set([...extractEmails(recipientInput), ...parsedEmails])).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl text-white shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-slate-100">Compose & Schedule Email Campaign</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Lead CSV/Text File Upload */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Upload Lead List (CSV or TXT)
            </label>
            <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950 rounded-xl p-4 transition text-center relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .txt"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                <Upload className="w-6 h-6 text-indigo-400" />
                <p className="text-xs text-slate-300 font-medium">
                  Click or drag CSV/TXT file here to import email leads
                </p>
                <p className="text-[11px] text-slate-500">Supports comma, newline, or tab separated values</p>
              </div>
            </div>

            {fileDetails && (
              <div className="mt-2.5 p-2.5 bg-indigo-950/40 border border-indigo-800/60 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs text-slate-200 font-medium">{fileDetails.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full font-semibold">
                    {fileDetails.count} emails detected
                  </span>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="text-slate-400 hover:text-red-400 text-xs p-1 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Manual Recipient Fallback */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-400">
                Or Enter Email Recipients Manually
              </label>
              {totalCount > 0 && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {totalCount} total recipient{totalCount > 1 ? 's' : ''} ready
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="lead1@company.com, lead2@company.com"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Subject</label>
            <input
              type="text"
              required
              placeholder="Enter subject line..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Body</label>
            <textarea
              required
              rows={4}
              placeholder="Write your email body..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Settings Grid: Start Time, Delay, Hourly Limit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Start Time</label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Delay (seconds)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={delayBetweenMs / 1000}
                onChange={(e) => setDelayBetweenMs(Math.max(0, parseFloat(e.target.value) * 1000))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Hourly Limit</label>
              <input
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {loading ? 'Scheduling...' : `Schedule Batch (${totalCount})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};