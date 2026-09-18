"use client";
import {createContext,useContext,useState,type ReactNode} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {ArrowLeft} from 'lucide-react';
const BackContext=createContext<string|null>(null);
export function WorkspaceBackProvider({children}:{children:ReactNode}){
 const pathname=usePathname();
 const [paths,setPaths]=useState<string[]>([pathname]);
 let stack=paths;
 if(paths.at(-1)!==pathname){
  stack=paths.at(-2)===pathname?paths.slice(0,-1):[...paths,pathname];
  setPaths(stack);
 }
 return <BackContext.Provider value={stack.at(-2)??null}>{children}</BackContext.Provider>;
}
export default function WorkspaceBack(){
 const router=useRouter(),previous=useContext(BackContext);
 if(!previous)return null;
 return <button type="button" aria-label="Go back" title="Go back" data-tooltip="Go back" className="workspace-back-pill workspace-nav-pill inline-flex h-11 w-11 shrink-0 items-center justify-center" onClick={()=>router.push(previous)}><ArrowLeft aria-hidden="true" className="h-5 w-5"/></button>;
}
