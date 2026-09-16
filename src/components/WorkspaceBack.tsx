"use client";
import {createContext,useContext,useEffect,useRef,type ReactNode,type RefObject} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {ArrowLeft} from 'lucide-react';
const BackContext=createContext<RefObject<string[]>|null>(null);
export function WorkspaceBackProvider({children}:{children:ReactNode}){
 const pathname=usePathname(),paths=useRef<string[]>([]);
 useEffect(()=>{const stack=paths.current;if(stack.at(-1)===pathname)return;if(stack.at(-2)===pathname)stack.pop();else stack.push(pathname);},[pathname]);
 return <BackContext.Provider value={paths}>{children}</BackContext.Provider>;
}
export default function WorkspaceBack(){
 const pathname=usePathname(),router=useRouter(),paths=useContext(BackContext);
 return <button type="button" aria-label="Go back" title="Go back" className="workspace-page-back inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" onClick={()=>{if(paths && paths.current.length>1)router.back();else router.push(pathname==='/dashboard'?'/dashboard/insights':'/dashboard');}}><ArrowLeft className="h-5 w-5"/></button>;
}
