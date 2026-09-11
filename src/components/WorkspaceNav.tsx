'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderKanban, CheckSquare, Users, Menu } from 'lucide-react';

export default function WorkspaceNav({ isAdmin, mobile = false }: { isAdmin: boolean; mobile?: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const links = [
    { href: '/dashboard', label: 'Projects', icon: FolderKanban, active: pathname === '/dashboard' || pathname.startsWith('/dashboard/projects') },
    { href: '/dashboard/my-tasks', label: 'My Tasks', icon: CheckSquare, active: pathname === '/dashboard/my-tasks' },
    { href: '/dashboard/tasks', label: 'All Tasks', icon: CheckSquare, active: pathname === '/dashboard/tasks' },
    ...(isAdmin ? [{ href: '/dashboard/workload', label: 'Workload', icon: Users, active: pathname === '/dashboard/workload' }, { href: '/admin/users', label: 'Team Users', icon: Users, active: pathname.startsWith('/admin') }] : []),
  ];
  const navigation = <nav aria-label="Workspace" className={mobile ? "grid gap-1 py-2 text-sm font-medium" : "flex items-center gap-1 text-sm font-medium"}>
    {links.map(({ href, label, icon: Icon, active }) => <Link onClick={() => { if(menu.current) menu.current.open = false; }} key={href} href={href} aria-current={active ? 'page' : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 transition ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
      <Icon className="h-4 w-4" />{label}
    </Link>)}
  </nav>;
  if (!mobile) return navigation;
  return <details ref={menu} className="rounded-lg border border-gray-200 bg-surface" onKeyDown={e => {if(e.key==='Escape' && menu.current) {menu.current.open=false; menu.current.querySelector('summary')?.focus();}}}>
    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium"><span>{links.find(link=>link.active)?.label || 'Workspace'}</span><span className="flex items-center gap-2"><Menu className="h-4 w-4"/>Menu</span></summary>
    {navigation}
  </details>;
}
