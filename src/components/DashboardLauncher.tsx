'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ChartNoAxesCombined } from 'lucide-react';
const InsightsPanel=dynamic(()=>import('./InsightsPanel'),{ssr:false});
export default function DashboardLauncher(){const [open,setOpen]=useState(false);return <><button className="insights-tab" type="button" aria-haspopup="dialog" onClick={()=>setOpen(true)}><ChartNoAxesCombined aria-hidden="true" className="h-4 w-4"/><span>Dashboard</span></button>{open&&<InsightsPanel onClose={()=>setOpen(false)}/>}</>;}
