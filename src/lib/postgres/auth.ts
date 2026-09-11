import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { createHash, randomBytes } from 'node:crypto';
import { pool, transaction } from './db';
import { hashPassword, verifyPassword } from './password';
export const SESSION_COOKIE=process.env.NODE_ENV==='production'?'__Host-tasktracker_staging':'tasktracker_staging';
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
export const currentUser=cache(async()=>{
  const token=(await cookies()).get(SESSION_COOKIE)?.value;
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const {rows}=await pool().query('SELECT u.id,u.email FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND NOT u.disabled',[digest(token)]);
  return rows[0] as {id:string;email:string}|undefined || null;
});
export async function assertAdmin(){
  const user=await currentUser();if(!user)throw new Error('Sign in with an admin account.');
  const rows=await transaction(user.id,async db=>(await db.query("SELECT id FROM public.profiles WHERE id=$1 AND role='admin'",[user.id])).rows);
  if(!rows.length)throw new Error('Admin privileges required.');return user;
}
async function issueSession(userId:string){
  const token=randomBytes(32).toString('hex');
  await pool().query("INSERT INTO auth.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",[digest(token),userId]);
  (await cookies()).set(SESSION_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:7*86400});
}
async function attempt(email:string){
  const key=digest(email);
  const {rows}=await pool().query(`INSERT INTO auth.login_attempts(key,attempts,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth.login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE auth.login_attempts.attempts+1 END, window_start=CASE WHEN auth.login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE auth.login_attempts.window_start END RETURNING attempts`,[key]);
  if(rows[0].attempts>10)throw new Error('Too many sign-in attempts. Try again in 15 minutes.');
}
const wrap=async<T>(work:()=>Promise<T>)=>{try{return {data:await work(),error:null};}catch(error){return {data:null,error:{message:error instanceof Error?error.message:'Authentication failed.'}};}};
export function localAuth(){return {
  getUser:async()=>({data:{user:await currentUser()},error:null}),
  signInWithPassword:({email,password}:{email:string;password:string})=>wrap(async()=>{
    email=email.trim().toLowerCase();if(email.length>254||typeof password!=='string')throw new Error('Invalid email or password.');
    await attempt(email);
    const {rows}=await pool().query('SELECT id,password_hash,disabled FROM auth.users WHERE lower(email)=$1',[email]);
    const found=rows[0];const valid=await verifyPassword(password,found?.password_hash||null);
    if(!valid||!found||found.disabled)throw new Error('Invalid email or password.');
    // Lock against a password reset between verification and session creation.
    const db=await pool().connect();
    try {await db.query('BEGIN');const {rows:current}=await db.query('SELECT password_hash,disabled FROM auth.users WHERE id=$1 FOR UPDATE',[found.id]);
      if(!current.length||current[0].disabled||current[0].password_hash!==found.password_hash)throw new Error('Invalid email or password.');
      const token=randomBytes(32).toString('hex');await db.query("INSERT INTO auth.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",[digest(token),found.id]);
      await db.query('DELETE FROM auth.login_attempts WHERE key=$1',[digest(email)]);await db.query('COMMIT');
      (await cookies()).set(SESSION_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:7*86400});
    }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
    return {user:{id:found.id,email}};
  }),
  signOut:()=>wrap(async()=>{const jar=await cookies();const token=jar.get(SESSION_COOKIE)?.value;if(token)await pool().query('DELETE FROM auth.sessions WHERE token_hash=$1',[digest(token)]);jar.delete(SESSION_COOKIE);return {}; }),
  updateUser:({password}:{password:string})=>wrap(async()=>{const user=await currentUser();if(!user)throw new Error('Sign in before changing your password.');await replacePassword(user.id,password);await issueSession(user.id);return {user};}),
  admin:{
    createUser:({email,password,user_metadata}:{email:string;password:string;user_metadata:{full_name:string}})=>wrap(async()=>{
      await assertAdmin();const passwordHash=await hashPassword(password);const db=await pool().connect();
      try{await db.query('BEGIN');await db.query('SET LOCAL ROLE service_role');const {rows}=await db.query('INSERT INTO auth.users(id,email,password_hash,raw_user_meta_data) VALUES(gen_random_uuid(),$1,$2,$3) RETURNING id,email',[email,passwordHash,user_metadata]);
        await db.query('INSERT INTO profiles(id,email,full_name) VALUES($1,$2,$3)',[rows[0].id,email,user_metadata.full_name]);await db.query('COMMIT');return {user:rows[0]};
      }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
    }),
    updateUserById:(id:string,{password}:{password:string})=>wrap(async()=>{await assertAdmin();await replacePassword(id,password);return {user:{id}};}),
    deleteUser:(id:string)=>wrap(async()=>{const caller=await assertAdmin();if(caller.id===id)throw new Error('You cannot delete your own account.');await pool().query('DELETE FROM auth.users WHERE id=$1',[id]);return {}; }),
  }
};}
async function replacePassword(id:string,password:string){
  const encoded=await hashPassword(password),db=await pool().connect();
  try {await db.query('BEGIN');const result=await db.query('UPDATE auth.users SET password_hash=$1 WHERE id=$2',[encoded,id]);if(!result.rowCount)throw new Error('Member not found.');await db.query('DELETE FROM auth.sessions WHERE user_id=$1',[id]);await db.query('COMMIT');}
  catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
