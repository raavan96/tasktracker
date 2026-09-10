'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderKanban, CheckSquare, Users } from 'lucide-react';

export default function WorkspaceNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: '/dashboard', label: 'Projects', icon: FolderKanban, active: pathname === '/dashboard' || pathname.startsWith('/dashboard/projects') },
    { href: '/dashboard/my-tasks', label: 'My Tasks', icon: CheckSquare, active: pathname === '/dashboard/my-tasks' },
    { href: '/dashboard/tasks', label: 'All Tasks', icon: CheckSquare, active: pathname === '/dashboard/tasks' },
    ...(isAdmin ? [{ href: '/dashboard/workload', label: 'Workload', icon: Users, active: pathname === '/dashboard/workload' }, { href: '/admin/users', label: 'Team Users', icon: Users, active: pathname.startsWith('/admin') }] : []),
  ];
  return <nav aria-label="Workspace" className="flex items-center gap-1 overflow-x-auto text-sm font-medium">
    {links.map(({ href, label, icon: Icon, active }) => <Link key={href} href={href} aria-current={active ? 'page' : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 transition ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
      <Icon className="h-4 w-4" />{label}
    </Link>)}
  </nav>;
}
