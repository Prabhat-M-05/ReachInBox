'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { ComposeModal } from '@/components/ComposeModal';
import { EmailTable } from '@/components/EmailTable';
import { api, EmailItem } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { Search, Plus, Filter, RefreshCw, LogIn } from 'lucide-react';

export default function Dashboard() {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user?.id || '';

  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSlackConnected, setIsSlackConnected] = useState(false);

  // Direct redirection to backend OAuth endpoint to avoid cross-port state generation mismatch
 const handleGoogleSignIn = async () => {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/dashboard', // Automatically uses current domain (localhost or Vercel)
      additionalParams: { prompt: 'select_account' },
    });
  };

  // Fetch Slack Connection Status
  useEffect(() => {
    if (!userId) return;

    const checkSlackStatus = async () => {
      try {
        const response = await api.get(`/api/slack/status?userId=${userId}`, {
          withCredentials: true,
        });
        setIsSlackConnected(Boolean(response.data?.isConnected));
      } catch (error) {
        console.error('Failed to fetch Slack status:', error);
      }
    };

    checkSlackStatus();
  }, [userId]);

  // Fetch Emails Callback
  const fetchEmails = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const params: Record<string, string> = { userId };
      if (searchQuery) params.query = searchQuery;
      if (statusFilter) params.status = statusFilter;

      const response = await api.get('/api/emails/search', { 
        params,
        withCredentials: true,
      });

      const listData = response.data?.data || response.data || [];
      setEmails(Array.isArray(listData) ? listData : []);
    } catch (error) {
      console.error('Failed to load search results:', error);
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, [userId, searchQuery, statusFilter]);

  // Debounced Search Effect
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmails();
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchEmails]);

  // Loading screen while verifying session
  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-medium">Checking authentication status...</p>
      </div>
    );
  }

  // Show clean Login Screen if unauthenticated (prevents infinite redirect loops)
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-12 h-12 bg-indigo-600/20 text-indigo-400 rounded-xl flex items-center justify-center mx-auto border border-indigo-500/30">
            <LogIn className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Welcome to ReachInBox</h1>
            <p className="text-slate-400 text-sm">Please sign in to monitor and manage your scheduled email campaigns.</p>
          </div>
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3 px-4 rounded-xl transition shadow-lg cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        userId={userId}
        isSlackConnected={isSlackConnected}
        onRefresh={fetchEmails}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3 max-w-2xl">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Instant Elasticsearch search (Subject, Body, Recipient)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Status Filter Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 appearance-none pr-8 cursor-pointer transition"
              >
                <option value="">All Statuses</option>
                <option value="SENT">Sent</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="PROCESSING">Processing</option>
                <option value="RATE_LIMITED">Rate Limited</option>
                <option value="FAILED">Failed</option>
              </select>
              <Filter className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={fetchEmails}
              title="Refresh Email List"
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-2 rounded-lg text-slate-400 hover:text-slate-100 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Compose Email
          </button>
        </div>

        {/* Email Monitoring Table */}
        <EmailTable emails={emails} loading={loading} />
      </main>

      <ComposeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userId={userId}
        onSuccess={fetchEmails}
      />
    </div>
  );
}