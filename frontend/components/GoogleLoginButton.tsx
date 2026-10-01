'use client';

import { authClient } from '@/lib/auth-client';
import { LogIn } from 'lucide-react';

export function GoogleLoginButton() {
  const handleGoogleSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: 'google',
        // 📍 Dynamic origin ensures it works on both localhost and Vercel
        callbackURL: `${window.location.origin}/dashboard`,
        additionalParams: { prompt: 'select_account' },
      });
    } catch (error) {
      console.error('Google sign-in failed:', error);
    }
  };

  return (
    <button
      onClick={handleGoogleSignIn}
      className="flex items-center justify-center gap-3 bg-white text-slate-900 font-semibold px-5 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-100 transition shadow-sm cursor-pointer"
    >
      <LogIn className="w-5 h-5 text-indigo-600" />
      Sign in with Google
    </button>
  );
}