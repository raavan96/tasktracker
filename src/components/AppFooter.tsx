'use client';
import {useState} from 'react';
import {usePathname} from 'next/navigation';
import Image from 'next/image';
import {Heart,ExternalLink} from 'lucide-react';
import Modal from './Modal';
const upiId='naidu.aishwarya9-1@okhdfcbank';
const paymentUrl=`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent('Aishwarya Naidu')}&cu=INR&tn=${encodeURIComponent('Support TaskTracker')}`;
export default function AppFooter({workspace=false}:{workspace?:boolean}){
 const pathname=usePathname();
 const [open,setOpen]=useState(false);
 const workspaceRoute=pathname.startsWith('/dashboard')||pathname.startsWith('/admin');
 if(workspace!==workspaceRoute)return null;
 return <><footer className="app-footer"><div><p>Created by <strong>Aishwarya Naidu</strong></p><p className="app-footer-support">Help keep TaskTracker running smoothly with a contribution via UPI.</p></div><button type="button" className="app-support-button" onClick={()=>setOpen(true)}><Heart aria-hidden="true" size={17}/>Support via UPI</button></footer>{open&&<Modal title="Support TaskTracker" onClose={()=>setOpen(false)}><p className="text-sm text-gray-500">Your contribution helps cover hosting and keep TaskTracker running smoothly. Thank you for supporting the app.</p><a href="/support-upi-qr.png" target="_blank" rel="noopener noreferrer" aria-label="Open full-size payment QR code" className="my-5 block mx-auto" style={{maxWidth:320}}><Image src="/support-upi-qr.png" alt="Scan to support TaskTracker via UPI — Aishwarya Naidu" width={1278} height={1432} unoptimized style={{width:'100%',height:'auto',borderRadius:16}}/></a><div className="flex flex-wrap gap-3"><a className="app-support-button" href={paymentUrl}><ExternalLink size={17} aria-hidden="true"/>Open UPI app</a></div><p className="mt-4 text-xs text-gray-500">Contributions are optional. Choose the amount and confirm in your UPI app. Scan the QR code with your UPI app, or tap the image to view it full size.</p></Modal>}</>;
}
