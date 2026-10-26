import {cookies} from 'next/headers';
import StartPageSettings from './StartPageSettings';
import {workspaceRead} from '@/lib/workspace-data';
import ChatPopup from './ChatPopup';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { signOut } from '@/app/auth/actions';
import ArchiveNotice from './ArchiveNotice';
import AppFooter from './AppFooter';
import MorningPrompt from './MorningPrompt';
import WorkspaceAccountControls from './WorkspaceAccountControls';
import WorkspaceNav from './WorkspaceNav';
import {WorkspaceBackProvider} from './WorkspaceBack';
import WorkspaceHelp from './WorkspaceHelp';
import WorkspaceTooltips from './WorkspaceTooltips';
import AppLogoMark from './AppLogo';
import CommandPaletteTrigger from './CommandPaletteTrigger';
import GlobalCommandPalette from './GlobalCommandPalette';
import MobileBottomNav from './MobileBottomNav';
import { 
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
  const landing=await workspaceRead(async db=>(await db.query('SELECT landing_page FROM workspace_preferences WHERE user_id=auth.uid()')).rows[0]?.landing_page||'/dashboard');
  const isAdmin = profile?.role === 'admin';
  const initialSeen=(await cookies()).get('tasktracker-tour-'+user.id)?.value==='seen';

  return (
    <WorkspaceBackProvider><div className="workspace-shell min-h-screen bg-gray-50 flex flex-col">
      <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('tasktracker-sidebar-expanded')==='false'){document.documentElement.setAttribute('data-sidebar-expanded','false')}else{document.documentElement.setAttribute('data-sidebar-expanded','true')}}catch(e){}` }} />
      <div className="workspace-wallpaper" aria-hidden="true" /><WorkspaceTooltips />
      <aside className="dark-workspace-sidebar" aria-label="Sidebar">
        <Link href="/dashboard" className="workspace-brand flex items-center gap-3 font-semibold">
          <span className="workspace-mark"><AppLogoMark className="h-5 w-5" /></span>
          <span>TaskTracker<span className="workspace-brand-caption">collegedunia.com</span></span>
        </Link>
        <p className="workspace-nav-caption">WORKSPACE</p>
        <WorkspaceNav isAdmin={isAdmin} />
      </aside>
      {/* Top Navigation */}
      <div className="workspace-header-mask"><header className="workspace-header bg-surface border-b border-gray-200 sticky top-0 z-30">
        <div className="workspace-header-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 xl:gap-5 min-w-0">
            <Link href="/dashboard" className="workspace-header-brand flex items-center space-x-2 font-bold text-gray-900 text-base sm:text-lg shrink-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <AppLogoMark className="w-5 h-5" />
              </div>
              <span>TaskTracker<span className="workspace-brand-caption">collegedunia.com</span></span>
            </Link>

            <span className="workspace-context hidden 2xl:inline shrink-0">Central Team Workspace</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <CommandPaletteTrigger />
            <WorkspaceHelp initialSeen={initialSeen} userId={user.id} isAdmin={isAdmin} buttonOnly />

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

            <WorkspaceAccountControls userId={user.id}><StartPageSettings initial={landing}/>            <Link href="/reset-password" title="Change password" aria-label="Change password" className="flex min-h-11 items-center gap-2 rounded-lg p-2 text-sm hover:bg-gray-100"><KeyRound className="w-4 h-4" />Change password</Link>
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
            </WorkspaceAccountControls>
          </div>
        </div>
        <div className="xl:hidden px-4 pb-3"><WorkspaceNav isAdmin={isAdmin} mobile /></div>
      </header></div>

      <ArchiveNotice />
      {/* Main Content Area */}
      <main className="workspace-main flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <WorkspaceHelp initialSeen={initialSeen} userId={user.id} isAdmin={isAdmin} /><MorningPrompt userId={user.id} />
        {children}
      </main>
      <AppFooter workspace /><ChatPopup userId={user.id} /><GlobalCommandPalette isAdmin={isAdmin} /><MobileBottomNav unreadCount={Number(unreadCount) || 0} />
    </div></WorkspaceBackProvider>
  );
}
