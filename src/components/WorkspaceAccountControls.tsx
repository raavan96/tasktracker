'use client';
import {useSyncExternalStore} from 'react';
import WorkspaceAppearance from './WorkspaceAppearance';
import {ThemeToggle} from './ThemeProvider';
import ActionsMenu from './ActionsMenu';
const query='(max-width: 767px)';
function subscribe(callback:()=>void){const media=window.matchMedia(query);media.addEventListener('change',callback);return()=>media.removeEventListener('change',callback);}
export default function WorkspaceAccountControls({userId,children}:{userId:string;children:React.ReactNode}){
 const mobile=useSyncExternalStore(subscribe,()=>window.matchMedia(query).matches,()=>false);
 const appearance=<WorkspaceAppearance userId={userId}/>;
 const theme=<ThemeToggle/>;
 return mobile?<ActionsMenu label="Settings"><div className="mobile-appearance-options"><div>{appearance}<span>Wallpaper &amp; transparency</span></div><div>{theme}<span>Light / dark mode</span></div></div>{children}</ActionsMenu>:<>{appearance}{theme}<ActionsMenu label="My account">{children}</ActionsMenu></>;
}
