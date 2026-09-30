'use client';

import React from 'react';
import { Mail, LogOut, CheckCircle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client'; // Import your auth client

// Custom SVG Icon for Slack
const SlackIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    className={className}
    viewBox="0 0 122.8 122.8"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" />
    <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" />
    <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C77.6 5.8 83.4 0 90.5 0s12.9 5.8 12.9 12.9v32.3z" />
    <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" />
  </svg>
);

interface NavbarProps {
  userId: string;
  isSlackConnected: boolean;
  onRefresh: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ userId, isSlackConnected, onRefresh }) => {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.replace('/');
      router.refresh();
    } catch (error) {
      console.error('Sign-out failed:', error);
    }
  };

  const handleSlackLogin = () => {
    window.location.href = `http://localhost:4000/api/slack/auth?userId=${encodeURIComponent(userId)}`;
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-lg">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">ReachInbox</h1>
          <p className="text-xs text-slate-400">Outreach & Scheduling Engine</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          title="Refresh Data"
        >
          <RefreshCw className="w-5 h-5" />
        </button>

        {isSlackConnected ? (
          <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Slack Connected
          </div>
        ) : (
          <button
            onClick={handleSlackLogin}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
          >
            <SlackIcon className="w-4 h-4 text-emerald-400" />
            Connect Slack
          </button>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </header>
  );
};