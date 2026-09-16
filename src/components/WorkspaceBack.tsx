'use client';
import {useEffect,useRef} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {ArrowLeft} from 'lucide-react';
export default function WorkspaceBack(){
 const pathname=usePathname(),router=useRouter(),paths=useRef<string[]>([]);
 useEffect(()=>{const stack=paths.current;if(stack.at(-1)===pathname)return;if(stack.at(-2)===pathname)stack.pop();else stack.push(pathname);},[pathname]);
 return <button type="button" aria-label="Go back" title="Go back" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={()=>{if(paths.current.length>1)router.back();else router.push(pathname==='/dashboard'?'/dashboard/insights':'/dashboard');}}><ArrowLeft className="h-5 w-5"/></button>;
}
