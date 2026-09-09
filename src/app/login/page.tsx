'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/ThemeProvider';
import { signIn } from '@/app/auth/actions';
import { Loader2, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const domain = process.env.NEXT_PUBLIC_COMPANY_DOMAIN;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);

    const res = await signIn(formData);
    if (res?.error) setErrorMessage(res.error);

    setIsLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="max-w-md w-full bg-surface p-8 rounded-xl shadow-sm border border-gray-200">
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Sign in to your account
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {domain && domain !== '*' ? `Authorized for @${domain} members only` : 'Team Task Tracker'}
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Email</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              <input
                name="email"
                type="email"
                required
                placeholder={domain && domain !== '*' ? `you@${domain}` : 'you@example.com'}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>


            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">Password</label>

              </div>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm flex items-center justify-center transition disabled:opacity-50 text-sm"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Sign In <ArrowRight className="w-4 h-4 ml-1.5" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-500 text-center">Need an account or forgot your password? Contact your workspace admin.</p>
      </div>
    </div>
  );
}
