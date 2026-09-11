import 'server-only';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, isAbsolute, dirname } from 'node:path';
import type { Run } from './query';
export function filePath(path:string){
  const root=process.env.ATTACHMENTS_DIR;
  if(!root||!isAbsolute(root))throw new Error('An absolute ATTACHMENTS_DIR is required.');
  if(!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-zA-Z0-9._-]{1,150}$/.test(path)||path.split('/').some(p=>p==='.'||p==='..'))throw new Error('Invalid attachment path.');
  return join(root,path);
}
const wrap=async<T>(work:()=>Promise<T>)=>{try{return {data:await work(),error:null};}catch{ return {data:null,error:{message:'Attachment operation failed. Check access and server storage.'}};}};
export function localStorage(run:Run){return {from:(bucket:string)=>{
  if(bucket!=='task-files')throw new Error('Unknown storage bucket.');
  async function allowed(path:string){filePath(path);const task=path.split('/')[0];return run(async db=>{const {rows}=await db.query('SELECT can_work_task($1) allowed',[task]);if(!rows[0]?.allowed)throw new Error('Access denied.');});}
  return {
    upload:(path:string,file:File)=>wrap(async()=>{await allowed(path);const target=filePath(path);if(file.size<1||file.size>10485760)throw new Error('File size exceeded');await mkdir(dirname(target),{recursive:true,mode:0o700});await writeFile(target,Buffer.from(await file.arrayBuffer()),{flag:'wx',mode:0o600});return {path};}),
    remove:(paths:string[])=>wrap(async()=>{for(const path of paths){await allowed(path);const exists=await run(async db=>(await db.query('SELECT id FROM task_attachments WHERE storage_path=$1',[path])).rows.length);if(exists)throw new Error('Remove attachment metadata before deleting its file.');await unlink(filePath(path));}return [];}),
    createSignedUrl:(path:string)=>wrap(async()=>{const rows=await run(async db=>(await db.query('SELECT id FROM task_attachments WHERE storage_path=$1',[path])).rows);if(!rows.length)throw new Error('Access denied');return {signedUrl:`/api/attachments/${rows[0].id}`};}),
  };
}};}
export async function readAttachment(path:string){return readFile(filePath(path));}
