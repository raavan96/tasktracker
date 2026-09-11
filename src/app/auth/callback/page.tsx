import Link from 'next/link';
import SupabaseCallback from './SupabaseCallback';
export default function AuthCallbackPage(){
  if(process.env.DATA_BACKEND!=='postgres')return <SupabaseCallback />;
  return <main className="p-8"><h1 className="text-xl font-semibold">Sign in with your workspace password</h1><p className="my-4">Contact your admin if you need a password reset.</p><Link href="/login">Go to sign in</Link></main>;
}
