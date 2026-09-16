'use client';
import {useState} from 'react';
import {usePathname} from 'next/navigation';
import {Heart,Copy,ExternalLink} from 'lucide-react';
import Modal from './Modal';
const upiId='naidu.aishwarya9-1@okhdfcbank';
const paymentUrl=`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent('Aishwarya Naidu')}&cu=INR&tn=${encodeURIComponent('Support TaskTracker')}`;
export default function AppFooter({workspace=false}:{workspace?:boolean}){
 const pathname=usePathname();
 const [open,setOpen]=useState(false),[message,setMessage]=useState('');
 const workspaceRoute=pathname.startsWith('/dashboard')||pathname.startsWith('/admin');
 if(workspace!==workspaceRoute)return null;
 return <><footer className="app-footer"><div><p>Created by <strong>Aishwarya Naidu</strong></p><p className="app-footer-support">Help keep TaskTracker running smoothly with a contribution via UPI.</p></div><button type="button" className="app-support-button" onClick={()=>{setMessage('');setOpen(true);}}><Heart aria-hidden="true" size={17}/>Support via UPI</button></footer>{open&&<Modal title="Support TaskTracker" onClose={()=>setOpen(false)}><p className="text-sm text-gray-500">Your contribution helps cover hosting and keep TaskTracker running smoothly. Thank you for supporting the app.</p><div className="my-5 rounded-xl border p-4"><p className="mb-2 text-xs text-gray-500">UPI ID</p><p className="break-all text-sm font-semibold select-all">{upiId}</p></div><div className="flex flex-wrap gap-3"><button type="button" className="app-support-button" onClick={async()=>{try{await navigator.clipboard.writeText(upiId);setMessage('UPI ID copied.');}catch{setMessage('Please select and copy the UPI ID above.');}}}><Copy size={17} aria-hidden="true"/>Copy UPI ID</button><a className="app-support-button" href={paymentUrl}><ExternalLink size={17} aria-hidden="true"/>Open UPI app</a></div><p className="mt-4 text-xs text-gray-500">Contributions are optional. Choose the amount and confirm in your UPI app. On a computer, copy this ID into your phone’s UPI app.</p><p role="status" className="mt-3 text-sm">{message}</p></Modal>}</>;
}
