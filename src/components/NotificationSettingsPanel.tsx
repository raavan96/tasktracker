'use client';
import {useId,useState,type ReactNode} from 'react';
import {Settings2,ChevronDown} from 'lucide-react';
export default function NotificationSettingsPanel({children}:{children:ReactNode}){
 const [open,setOpen]=useState(false),id=useId();
 return <div className="mx-auto mt-auto w-full max-w-4xl border-t pt-5">
 <button type="button" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm text-gray-600"><Settings2 className="h-4 w-4" aria-hidden="true"/>Notification settings<ChevronDown className={`h-4 w-4 transition-transform duration-150 motion-reduce:transition-none ${open?'rotate-180':''}`} aria-hidden="true"/></button>
 <div id={id} hidden={!open} className="mt-4">{children}</div>
 </div>;
}
