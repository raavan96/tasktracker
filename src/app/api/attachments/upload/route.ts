import {currentUser} from '@/lib/postgres/auth';
import {uploadAttachment} from '@/app/dashboard/tasks/extras';
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(!origin||new URL(origin).host!==request.headers.get('host'))return Response.json({error:'Invalid request origin.'},{status:403});
 if(!await currentUser())return Response.json({error:'Please sign in again.'},{status:401});
 if(Number(request.headers.get('content-length')||0)>12*1024*1024)return Response.json({error:'Choose a file up to 10 MB.'},{status:413});
 try{const form=await request.formData();const result=await uploadAttachment(String(form.get('taskId')||''),String(form.get('projectId')||''),form);return Response.json(result,{status:result.error?400:200});}catch{return Response.json({error:'Upload could not be confirmed. Refresh before retrying.'},{status:400});}
}
