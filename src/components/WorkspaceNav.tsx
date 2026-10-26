'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import WorkspaceBack from './WorkspaceBack';
import { usePathname } from 'next/navigation';
import { 
  ChartNoAxesCombined, 
  FolderKanban, 
  CheckSquare, 
  Users, 
  Archive, 
  Search, 
  BarChart3, 
  CalendarDays, 
  History, 
  ChevronLeft, 
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

function subscribeToSidebar(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('tasktracker:sidebar-toggle', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('tasktracker:sidebar-toggle', callback);
  };
}

function getSidebarSnapshot(): boolean {
  try {
    return localStorage.getItem('tasktracker-sidebar-expanded') !== 'false';
  } catch {
    return true;
  }
}

function getSidebarServerSnapshot(): boolean {
  return true;
}

export default function WorkspaceNav({ isAdmin, mobile = false }: { isAdmin: boolean; mobile?: boolean }) {
  const menu = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [overflow, setOverflow] = useState({before:false,after:false});
  const isExpanded = useSyncExternalStore(subscribeToSidebar, getSidebarSnapshot, getSidebarServerSnapshot);

  useEffect(() => {
    if (mobile) return;
    const sidebar = document.querySelector('.dark-workspace-sidebar');
    const shell = document.querySelector('.workspace-shell');
    const expandedVal = isExpanded ? 'true' : 'false';
    sidebar?.setAttribute('data-expanded', expandedVal);
    shell?.setAttribute('data-sidebar-expanded', expandedVal);
    document.documentElement.setAttribute('data-sidebar-expanded', expandedVal);
  }, [isExpanded, mobile]);

  const toggleSidebar = () => {
    try {
      localStorage.setItem('tasktracker-sidebar-expanded', String(!isExpanded));
      window.dispatchEvent(new Event('tasktracker:sidebar-toggle'));
    } catch {}
  };

  useEffect(() => {
    const rail=menu.current;if(!rail||!mobile)return;
    const update=()=>setOverflow({before:rail.scrollLeft>2,after:rail.scrollLeft+rail.clientWidth<rail.scrollWidth-2});
    const observer=new ResizeObserver(update);observer.observe(rail);if(rail.firstElementChild)observer.observe(rail.firstElementChild);
    rail.addEventListener("scroll",update,{passive:true});update();
    return ()=>{observer.disconnect();rail.removeEventListener("scroll",update);};
  },[mobile,pathname]);
  function scrollNavigation(direction:number){const rail=menu.current;if(rail)rail.scrollBy({left:direction*Math.max(100,rail.clientWidth*.7),behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});}
  useEffect(()=>{
    const center=()=>{const rail=menu.current;const active=rail?.querySelector<HTMLElement>('[aria-current="page"]');if(rail&&active)rail.scrollLeft=Math.max(0,rail.scrollLeft+active.getBoundingClientRect().left-rail.getBoundingClientRect().left-rail.clientWidth/2+active.offsetWidth/2);};
    center();window.addEventListener('resize',center);return ()=>window.removeEventListener('resize',center);
  },[pathname]);
  const links = [
    {href:'/dashboard/insights',label:'Dashboard',icon:ChartNoAxesCombined,active:pathname==='/dashboard/insights'},
    {href:'/dashboard',label:'Projects',icon:FolderKanban,active:pathname==='/dashboard'||pathname.startsWith('/dashboard/projects')},
    {href:'/dashboard/my-tasks',label:'My Tasks',icon:CheckSquare,active:pathname==='/dashboard/my-tasks'},
    {href:'/dashboard/tasks',label:'All Tasks',icon:CheckSquare,active:pathname==='/dashboard/tasks'},
    {href:'/dashboard/calendar',label:'Calendar',icon:CalendarDays,active:pathname==='/dashboard/calendar'},
    {href:'/dashboard/reports',label:'Reports',icon:BarChart3,active:pathname==='/dashboard/reports'},
    {href:'/dashboard/history',label:'History',icon:History,active:pathname==='/dashboard/history'},
    {href:'/dashboard/archive',label:'Archive',icon:Archive,active:pathname==='/dashboard/archive'},
    ...(isAdmin?[{href:'/dashboard/workload',label:'Workload',icon:Users,active:pathname==='/dashboard/workload'},{href:'/admin/users',label:'Team Users',icon:Users,active:pathname.startsWith('/admin')}]:[]),
  ];
  const navigation = <nav aria-label="Workspace" className={mobile ? "flex items-center gap-1 text-sm font-medium" : "flex flex-col gap-1 text-sm font-medium"}>
    {links.map(({ href, label, icon: Icon, active }) => <Link key={href} href={href} aria-label={label} data-tooltip={!mobile && !isExpanded ? label : undefined} title={!mobile && !isExpanded ? label : undefined} aria-current={active ? 'page' : undefined}
      className={`workspace-nav-item ${label==='Search'?'workspace-search-icon w-11 self-start justify-self-start justify-center':''} flex shrink-0 items-center gap-2 rounded-lg transition ${active ? 'workspace-nav-item-active bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="workspace-nav-label">{label}</span>
    </Link>)}
  </nav>;
  return <div className={`workspace-nav-stack ${mobile?'workspace-nav-stack-mobile':''}`}>
    <div className="workspace-nav-utilities">
      <div className="workspace-back-slot"><WorkspaceBack /></div>
      {!mobile && <button
        type="button"
        onClick={toggleSidebar}
        aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-expanded={isExpanded}
        title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        data-tooltip={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        className="workspace-sidebar-toggle-btn workspace-nav-pill"
      >
        {isExpanded ? <PanelLeftClose aria-hidden="true" className="h-4 w-4" /> : <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />}
      </button>}
    </div>
    <Link href="/dashboard/search" onClick={(e)=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&e.button===0){e.preventDefault();window.dispatchEvent(new CustomEvent('tasktracker:open-command-palette'));}}} className="workspace-search-pill workspace-nav-pill" aria-label="Search" data-tooltip={!mobile && !isExpanded ? "Search" : undefined} title={!mobile && !isExpanded ? "Search" : undefined} aria-current={pathname==='/dashboard/search'?'page':undefined}>
      <div className="workspace-search-content">
        <Search aria-hidden="true" className="h-4 w-4 shrink-0"/>
        <span className="workspace-search-label">Quick search…</span>
      </div>
      <kbd className="workspace-search-kbd">⌘K</kbd>
    </Link>
    <div className={`workspace-nav-group ${mobile?"workspace-nav-group-mobile":""}`}>
      {mobile&&<button type="button" className="workspace-nav-overflow" disabled={!overflow.before} aria-label="Show previous sections" title="Show previous sections" onClick={()=>scrollNavigation(-1)}><ChevronLeft aria-hidden="true" size={16}/></button>}
      <div ref={menu} className={`workspace-nav-pill workspace-nav-main ${mobile?'workspace-mobile-nav':''}`} aria-label={mobile?'Workspace navigation — swipe for more':undefined}>{navigation}</div>
      {mobile&&<button type="button" className="workspace-nav-overflow" disabled={!overflow.after} aria-label="Show more sections" title="Show more sections" onClick={()=>scrollNavigation(1)}><ChevronRight aria-hidden="true" size={16}/></button>}
    </div>

  </div>;
}
