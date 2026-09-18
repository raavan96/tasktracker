'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import WorkspaceBack from './WorkspaceBack';
import { usePathname } from 'next/navigation';
import { ChartNoAxesCombined, FolderKanban, CheckSquare, Users, Archive, Search, BarChart3, CalendarDays, Copy } from 'lucide-react';

export default function WorkspaceNav({ isAdmin, mobile = false }: { isAdmin: boolean; mobile?: boolean }) {
  const menu = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(()=>{const rail=menu.current;const active=rail?.querySelector<HTMLElement>('[aria-current="page"]');if(rail&&active)rail.scrollLeft=Math.max(0,active.offsetLeft-rail.offsetLeft-rail.clientWidth/2+active.offsetWidth/2);},[pathname]);
  const links = [
    {href:'/dashboard/insights',label:'Dashboard',icon:ChartNoAxesCombined,active:pathname==='/dashboard/insights'},
    {href:'/dashboard',label:'Projects',icon:FolderKanban,active:pathname==='/dashboard'||pathname.startsWith('/dashboard/projects')},
    {href:'/dashboard/my-tasks',label:'My Tasks',icon:CheckSquare,active:pathname==='/dashboard/my-tasks'},
    {href:'/dashboard/tasks',label:'All Tasks',icon:CheckSquare,active:pathname==='/dashboard/tasks'},
    {href:'/dashboard/calendar',label:'Calendar',icon:CalendarDays,active:pathname==='/dashboard/calendar'},
    {href:'/dashboard/reports',label:'Reports',icon:BarChart3,active:pathname==='/dashboard/reports'},
    {href:'/dashboard/templates',label:'Templates',icon:Copy,active:pathname==='/dashboard/templates'||pathname==='/dashboard/planning'},
    {href:'/dashboard/archive',label:'Archive',icon:Archive,active:pathname==='/dashboard/archive'},
    ...(isAdmin?[{href:'/dashboard/workload',label:'Workload',icon:Users,active:pathname==='/dashboard/workload'},{href:'/admin/users',label:'Team Users',icon:Users,active:pathname.startsWith('/admin')}]:[]),
  ];
  const navigation = <nav aria-label="Workspace" className={mobile ? "flex items-center gap-1 text-sm font-medium" : "flex items-center gap-1 text-sm font-medium"}>
    {links.map(({ href, label, icon: Icon, active }) => <Link key={href} href={href} aria-label={label} data-tooltip={label} title={label} aria-current={active ? 'page' : undefined}
      className={`${label==='Search'?'workspace-search-icon w-11 self-start justify-self-start justify-center':''} flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 transition ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
      <Icon aria-hidden="true" className="h-4 w-4" /><span className="workspace-nav-label">{label}</span>
    </Link>)}
  </nav>;
  return <div className={`workspace-nav-stack ${mobile?'workspace-nav-stack-mobile':''}`}>
    <WorkspaceBack />
    <Link href="/dashboard/search" className="workspace-search-pill workspace-nav-pill" aria-label="Search" data-tooltip="Search" title="Search" aria-current={pathname==='/dashboard/search'?'page':undefined}><Search aria-hidden="true" className="h-4 w-4"/></Link>
    <div ref={menu} className={`workspace-nav-pill workspace-nav-main ${mobile?'workspace-mobile-nav':''}`} aria-label={mobile?'Workspace navigation — swipe for more':undefined}>{navigation}</div>
  </div>;
}
