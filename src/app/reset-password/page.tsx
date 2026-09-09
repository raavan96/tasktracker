import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import PasswordForm from './PasswordForm';

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <main className="flex min-h-screen items-center justify-center p-6">
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-surface p-8 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-blue-700">TaskTracker</p>
      <h1 className="text-2xl font-semibold">Set your password</h1>
      {user ? <><p className="mb-6 mt-2 text-sm text-slate-600">Choose a password for your team workspace account.</p><PasswordForm /></> : <>
        <p role="alert" className="my-4 text-sm text-slate-600">Open your invitation or password-reset email link first. If it has expired, request a new reset link.</p>
        <Link href="/login" className="text-sm font-medium text-blue-700 underline">Return to sign in</Link>
      </>}
    </div>
  </main>;
}
