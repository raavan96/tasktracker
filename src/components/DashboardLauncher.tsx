'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ChartNoAxesCombined } from 'lucide-react';
const InsightsPanel=dynamic(()=>import('./InsightsPanel'),{ssr:false});
export default function DashboardLauncher(){const [open,setOpen]=useState(false);return <><button className="workspace-dashboard-button flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-slate-600 hover:bg-slate-100 transition" aria-label="Dashboard" data-tooltip="Dashboard" type="button" aria-haspopup="dialog" onClick={()=>setOpen(true)}><ChartNoAxesCombined aria-hidden="true" className="h-4 w-4"/><span className="workspace-nav-label">Dashboard</span></button>{open&&<InsightsPanel onClose={()=>setOpen(false)}/>}</>;}
