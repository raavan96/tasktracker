import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { signOut } from '@/app/auth/actions';
import WorkspaceNav from './WorkspaceNav';
import { ThemeToggle } from './ThemeProvider';
import { 
  FolderKanban, 
  LogOut, 
  Bell,
  KeyRound,
  ShieldCheck 
} from 'lucide-react';

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: profile }, { count: unreadCount }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('notifications').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('is_read', false),
  ]);
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-surface border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="flex items-center space-x-2 font-bold text-gray-900 text-lg">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <FolderKanban className="w-5 h-5" />
              </div>
              <span>TaskTracker</span>
            </Link>

            <div className="hidden xl:block"><WorkspaceNav isAdmin={isAdmin} /></div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <ThemeToggle />
            <Link href="/reset-password" title="Change password" aria-label="Change password" className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"><KeyRound className="w-5 h-5" /></Link>
            {/* Notification Indicator */}
            <Link
              href="/dashboard/notifications"
              className="relative p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition"
              title="Notifications" aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {Number(unreadCount) > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-600 rounded-full ring-2 ring-surface" />
              )}
            </Link>

            {/* Profile & Role Tag */}
            <div className="flex items-center space-x-3 border-l pl-4 border-gray-200">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-gray-900">{profile?.full_name || profile?.email}</div>
                <div className="text-xs text-gray-500 flex items-center justify-end">
                  {isAdmin && <ShieldCheck className="w-3 h-3 mr-1 text-purple-600" />}
                  <span className="capitalize">{profile?.role}</span>
                </div>
              </div>

              <form action={signOut}>
                <button
                  type="submit"
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Sign Out" aria-label="Sign out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </div>
        <div className="xl:hidden px-4 pb-3"><WorkspaceNav isAdmin={isAdmin} /></div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
