'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePassword } from '@/app/auth/actions';

export default function PasswordForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (formData.get('password') !== formData.get('confirmPassword')) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const result = await updatePassword(formData);
      if (result.error) setError(result.error);
      else { router.replace('/dashboard'); router.refresh(); }
    } catch { setError('Your password could not be saved. Please try again.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <label className="block text-sm font-medium">New password
      <input type="password" name="password" autoComplete="new-password" minLength={8} required className="mt-1 w-full rounded-lg border p-2.5" />
    </label>
    <p className="text-xs text-slate-600">Use at least 8 characters.</p>
    <label className="block text-sm font-medium">Confirm password
      <input type="password" name="confirmPassword" autoComplete="new-password" minLength={8} required className="mt-1 w-full rounded-lg border p-2.5" />
    </label>
    <button disabled={busy} className="w-full rounded-lg bg-blue-600 p-3 text-sm font-medium text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save password and continue'}</button>
  </form>;
}
