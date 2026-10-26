'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useRef,type ComponentProps} from 'react';
/** Prepare destinations on pointer/keyboard intent, rather than every visible task. */
export default function IntentLink({onMouseEnter,onFocus,...props}:Omit<ComponentProps<typeof Link>,'prefetch'>){
 const router=useRouter(),last=useRef(0);
 function prepare(){if(typeof props.href!=='string'||!props.href.startsWith('/')||Date.now()-last.current<30000)return;last.current=Date.now();router.prefetch(props.href);}
 return <Link {...props} prefetch={false} onMouseEnter={event=>{onMouseEnter?.(event);if(!event.defaultPrevented)prepare();}} onFocus={event=>{onFocus?.(event);if(!event.defaultPrevented)prepare();}}/>;
}
