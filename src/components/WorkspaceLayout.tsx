import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { signOut } from '@/app/auth/actions';
import ArchiveNotice from './ArchiveNotice';
import AppFooter from './AppFooter';
import MorningPrompt from './MorningPrompt';
import ActionsMenu from './ActionsMenu';
import WorkspaceNav from './WorkspaceNav';
import {WorkspaceBackProvider} from './WorkspaceBack';
import WorkspaceHelp from './WorkspaceHelp';
import WorkspaceAppearance from './WorkspaceAppearance';
import WorkspaceTooltips from './WorkspaceTooltips';
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
    <WorkspaceBackProvider><div className="workspace-shell min-h-screen bg-gray-50 flex flex-col">
      <div className="workspace-wallpaper" aria-hidden="true" /><WorkspaceTooltips />
      <aside className="dark-workspace-sidebar" aria-label="Sidebar">
        <Link href="/dashboard" className="workspace-brand flex items-center gap-3 font-semibold">
          <span className="workspace-mark"><FolderKanban className="h-5 w-5" /></span>
          <span>TaskTracker<span className="workspace-brand-caption">collegedunia.com</span></span>
        </Link>
        <p className="workspace-nav-caption">WORKSPACE</p>
        <WorkspaceNav isAdmin={isAdmin} />
      </aside>
      {/* Top Navigation */}
      <div className="workspace-header-mask"><header className="workspace-header bg-surface border-b border-gray-200 sticky top-0 z-30">
        <div className="workspace-header-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="workspace-header-brand flex items-center space-x-2 font-bold text-gray-900 text-base sm:text-lg">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <FolderKanban className="w-5 h-5" />
              </div>
              <span>TaskTracker<span className="workspace-brand-caption">collegedunia.com</span></span>
            </Link>

            <span className="workspace-context">Central Team Workspace</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <WorkspaceHelp userId={user.id} buttonOnly />
            <WorkspaceAppearance userId={user.id} />
            <ThemeToggle />

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

            <ActionsMenu label="My account">            <Link href="/reset-password" title="Change password" aria-label="Change password" className="flex min-h-11 items-center gap-2 rounded-lg p-2 text-sm hover:bg-gray-100"><KeyRound className="w-4 h-4" />Change password</Link>
            <div className="space-y-3 p-2">
              <div className="text-left">
                <div className="text-sm font-medium text-gray-900">{profile?.full_name || profile?.email}</div>
                <div className="text-xs text-gray-500 flex items-center">
                  {isAdmin && <ShieldCheck className="w-3 h-3 mr-1 text-purple-600" />}
                  <span className="capitalize">{profile?.role}</span>
                </div>
              </div>

              <form action={signOut}>
                <button
                  type="submit"
                  className="flex min-h-11 items-center gap-2 rounded-lg p-2 text-sm hover:bg-red-50"
                  title="Sign Out" aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" /><span>Sign out</span>
                </button>
              </form>
            </div>
            </ActionsMenu>
          </div>
        </div>
        <div className="xl:hidden px-4 pb-3"><WorkspaceNav isAdmin={isAdmin} mobile /></div>
      </header></div>

      <ArchiveNotice />
      {/* Main Content Area */}
      <main className="workspace-main flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <WorkspaceHelp userId={user.id} /><MorningPrompt userId={user.id} />
        {children}
      </main>
      <AppFooter workspace />
    </div></WorkspaceBackProvider>
  );
}
