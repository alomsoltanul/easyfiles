'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { resetPasswordAction } from '@/app/(site)/account/(auth)/actions';
import { Alert, Field, SubmitButton } from './primitives';

interface ResetFormProps {
  hasServerSession?: boolean;
}

export default function ResetForm({ hasServerSession = false }: ResetFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Status of the recovery session
  const [isVerifying, setIsVerifying] = useState(!hasServerSession);
  const [hasValidSession, setHasValidSession] = useState(hasServerSession);

  useEffect(() => {
    if (hasServerSession) {
      setIsVerifying(false);
      setHasValidSession(true);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setIsVerifying(false);
      setError('Authentication is not configured.');
      return;
    }

    // 1. Check if URL contains query errors or hash errors
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      const errorDesc =
        search.get('error_description') ||
        hash.get('error_description') ||
        search.get('error') ||
        hash.get('error');

      if (errorDesc) {
        setIsVerifying(false);
        setError(`Password reset error: ${errorDesc.replace(/\+/g, ' ')}`);
        return;
      }

      // If code was passed directly to /account/reset
      const code = search.get('code');
      if (code) {
        window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=/account/reset`);
        return;
      }
    }

    // 2. Listen to Supabase auth events (e.g. PASSWORD_RECOVERY)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && session.user)) {
        setHasValidSession(true);
        setIsVerifying(false);
        setError(null);
      }
    });

    // 3. Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && session.user) {
        setHasValidSession(true);
      } else {
        // Allow brief grace period for hash token parsing
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: retrySession } }) => {
            if (retrySession && retrySession.user) {
              setHasValidSession(true);
            } else {
              setHasValidSession(false);
            }
            setIsVerifying(false);
          });
        }, 800);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [hasServerSession]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 8) {
      setError('Use a password of at least 8 characters.');
      return;
    }

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();

      // 1. First attempt updating via browser client (direct session)
      if (supabase) {
        const { error: clientError } = await supabase.auth.updateUser({ password });
        if (!clientError) {
          setNotice('Password updated successfully! Redirecting...');
          setTimeout(() => {
            router.push('/account?reset=1');
            router.refresh();
          }, 1000);
          return;
        }
      }

      // 2. Fallback to server action
      const formData = new FormData();
      formData.set('password', password);
      formData.set('confirm', confirm);

      const serverRes = await resetPasswordAction({}, formData);
      if (serverRes.error) {
        setError(serverRes.error);
      }
    });
  };

  if (isVerifying) {
    return (
      <div className="py-8 text-center space-y-3">
        <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500">Verifying password reset link...</p>
      </div>
    );
  }

  if (!hasValidSession) {
    return (
      <div className="space-y-4">
        <Alert tone="error">
          {error || 'This password reset link is invalid or has expired. Please request a new one.'}
        </Alert>
        <div className="pt-2 text-center">
          <Link
            href="/account/forgot"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="notice">{notice}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters."
        />
        <Field
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <SubmitButton disabled={isPending}>{isPending ? 'Updating...' : 'Update password'}</SubmitButton>
      </form>
    </div>
  );
}
