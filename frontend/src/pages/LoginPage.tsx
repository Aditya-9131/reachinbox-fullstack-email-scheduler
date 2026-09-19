import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Shield, Clock, Send, CheckCircle2, ArrowRight } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginAsDemo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setLoading(true);
    setError(null);
    try {
      if (credentialResponse.credential) {
        // Decode JWT payload for client-side profile details
        let userInfo: any = null;
        try {
          const base64Url = credentialResponse.credential.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          userInfo = JSON.parse(jsonPayload);
        } catch {
          // ignore
        }

        await loginWithGoogle(credentialResponse.credential, userInfo);
      }
    } catch (err: any) {
      setError(err.message || 'Google Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      await loginAsDemo();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b12] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient glowing orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Outbox Labs Hiring Assignment</span>
          </div>

          <div className="flex items-center justify-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white text-2xl font-black shadow-xl shadow-blue-500/25">
              R
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            ReachInbox <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Scheduler</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Production-grade Email Job Scheduler with BullMQ, Redis, Elasticsearch & Ethereal SMTP.
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
          <div className="space-y-1 text-center">
            <h2 className="text-base font-semibold text-slate-100">Sign in to your account</h2>
            <p className="text-xs text-slate-400">Continue with Google OAuth to manage campaigns</p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs text-center">
              {error}
            </div>
          )}

          {/* Real Google OAuth Login Button */}
          <div className="flex flex-col items-center justify-center space-y-3 pt-2">
            <div className="w-full flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google OAuth Login encountered an error')}
                theme="filled_black"
                shape="pill"
                size="large"
                text="signin_with"
                width="320"
              />
            </div>

            <div className="relative w-full flex items-center justify-center py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <span className="relative px-3 bg-[#0f172a] text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                Or Quick Evaluation
              </span>
            </div>

            {/* Instant Demo Account Button */}
            <button
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium text-xs shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 transition-all active:scale-98"
            >
              <span>Instant Reviewer Sign-In (Demo Profile)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Feature Highlights */}
          <div className="pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-[11px] text-slate-400">
            <div className="flex items-center space-x-2">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Zero Cron Jobs</span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Hourly Rate Limiter</span>
            </div>
            <div className="flex items-center space-x-2">
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ethereal SMTP</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Restart Resilient</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-400">
          Built for <span className="text-slate-300 font-semibold">ReachInbox.ai</span> Engineering Assignment
        </p>
      </div>
    </div>
  );
};
