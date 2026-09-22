import React from 'react';
export interface AppLogoMarkProps extends React.SVGProps<SVGSVGElement> { size?: number | string; }
/** Approved folded-ribbon T, shared by all app branding surfaces. */
export function AppLogoMark({className='w-5 h-5',size,...props}:AppLogoMarkProps){
 return <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true" {...props}><image href="/branding/tasktracker-mark-v1.svg" width="100" height="100" /></svg>;
}
export default AppLogoMark;
