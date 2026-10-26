import { currentUser } from '@/lib/postgres/auth';
import { dashboardInsights,dashboardAgenda } from '@/lib/dashboard-insights';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 if(!await currentUser())return Response.json({error:'Please sign in again.'},{status:401,headers});
 const params=new URL(request.url).searchParams;
 try{if(params.get('scope')==='agenda')return Response.json(await dashboardAgenda(params.get('day')||''),{headers});return Response.json(await dashboardInsights(params.get('month')||undefined,params.get('day')||undefined),{headers});}
 catch(e){const invalid=e instanceof Error&&/^Invalid (month|day)$/.test(e.message);return Response.json({error:invalid?e.message:'Dashboard could not load. Please retry.'},{status:invalid?400:503,headers});}
}
