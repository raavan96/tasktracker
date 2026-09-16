import type {ReactNode} from 'react';
import WorkspaceBack from './WorkspaceBack';

export default function WorkspaceHeading({children,className=''}:{children:ReactNode;className?:string}){
 return <div className="workspace-page-heading flex min-w-0 items-center gap-2 sm:gap-3"><WorkspaceBack/><h1 className={`min-w-0 break-words ${className}`}>{children}</h1></div>;
}
