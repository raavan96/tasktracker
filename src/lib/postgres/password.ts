import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
// Serialize memory-intensive password work on the small host; reject a full queue.
let pending=0;let previous=Promise.resolve();
async function derive(password:string,salt:string):Promise<Buffer>{
  if(pending>=8)throw new Error('Sign-in is busy. Please retry shortly.');
  pending++;const before=previous;let release!:()=>void;
  previous=new Promise<void>(resolve=>{release=resolve;});
  try {await before;return await new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));}
  finally {pending--;release();}
}
export async function hashPassword(password:string){
  if(password.length<8||password.length>256)throw new Error('Password must contain 8–256 characters.');
  const salt=randomBytes(16).toString('hex');
  return `scrypt-v1$${salt}$${(await derive(password,salt)).toString('hex')}`;
}
export async function verifyPassword(password:string,encoded:string|null){
  if(password.length>256)return false;
  const parts=(encoded||'').split('$');
  const valid=parts.length===3&&parts[0]==='scrypt-v1'&&/^[a-f0-9]{32}$/.test(parts[1])&&/^[a-f0-9]{128}$/.test(parts[2]);
  const actual=await derive(password,valid?parts[1]:'0'.repeat(32));
  return timingSafeEqual(actual,Buffer.from(valid?parts[2]:'0'.repeat(128),'hex'))&&valid;
}
