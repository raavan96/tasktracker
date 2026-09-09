'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

export default function AuthCallbackPage() {
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    async function completeSignIn() {
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.slice(1));
      const requestedNext = url.searchParams.get('next');
      const next = requestedNext === '/reset-password' ? '/reset-password' : '/dashboard';
      // Remove one-time secrets from the visible URL before any navigation.
      window.history.replaceState(null, '', '/auth/callback');
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        isSingleton: false,
        auth: { detectSessionInUrl: false },
      });
      let result;
      const code = url.searchParams.get('code');
      const tokenHash = url.searchParams.get('token_hash');
      const type = url.searchParams.get('type');
      if (code) {
        result = await supabase.auth.exchangeCodeForSession(code);
      } else if (tokenHash && (type === 'invite' || type === 'recovery' || type === 'email')) {
        result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      } else if (fragment.get('access_token') && fragment.get('refresh_token')) {
        // Default Supabase invitation templates use an implicit token fragment.
        result = await supabase.auth.setSession({ access_token: fragment.get('access_token')!, refresh_token: fragment.get('refresh_token')! });
      } else {
        setError('This link is invalid or expired. Request a new link, or ask your admin for help.');
        return;
      }
      if (result.error || !result.data.session) {
        setError('This link could not be verified. Request a new link and open it in the same browser.');
        return;
      }
      const passwordFlow = type === 'invite' || type === 'recovery' || fragment.get('type') === 'invite' || fragment.get('type') === 'recovery';
      window.location.replace(passwordFlow ? '/reset-password' : next);
    }
    completeSignIn().catch(() => setError('We could not connect. Please reopen your email link and try again.'));
  }, []);
  return <main className="flex min-h-screen items-center justify-center p-6">
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold">{error ? 'Unable to sign in' : 'Verifying your link…'}</h1>
      <p role={error ? 'alert' : 'status'} className="mt-3 text-sm text-slate-600">{error || 'You’ll be taken to the next step shortly.'}</p>
      {error && <Link className="mt-5 inline-block font-medium text-blue-700 underline" href="/login">Return to sign in</Link>}
    </div>
  </main>;
}
