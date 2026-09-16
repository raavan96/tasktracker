import OverviewCards from '@/components/OverviewCards';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import ArchiveAction from '@/components/ArchiveAction';
import ArchiveSettings from './ArchiveSettings';
export default async function ArchivePage({searchParams}:{searchParams:Promise<{section?:string;q?:string}>}){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).single();const admin=profile?.role==='admin';
 const [projectsResult,tasksResult,settingsResult]=await Promise.all([
 db.from('projects').select('id,name,is_archived,archived_at,completed_at,created_by').eq('is_archived',true).order('archived_at',{ascending:false}),
 db.from('tasks').select('id,title,project_id,is_archived,archived_at,created_by,project:projects(name,is_archived,completed_at)').order('archived_at',{ascending:false}),
 db.from('archive_settings').select('*').eq('id',true).single()]);
 if(projectsResult.error||tasksResult.error||settingsResult.error)throw new Error('Archive could not load. Please retry.');
 const query=await searchParams;const completed=query.section==='completed';const search=(query.q||'').toLowerCase();
 const archiveProjects=projectsResult.data||[];
 const archiveTasks=(tasksResult.data||[]).map(t=>({...t,project:Array.isArray(t.project)?t.project[0]:t.project})).filter(t=>(t.is_archived||t.project?.is_archived)&&!t.project?.completed_at);
 const projects=(projectsResult.data||[]).filter(p=>Boolean(p.completed_at)===completed&&p.name.toLowerCase().includes(search));
 const tasks=(tasksResult.data||[]).map(t=>({...t,project:Array.isArray(t.project)?t.project[0]:t.project})).filter(t=>(t.is_archived||t.project?.is_archived)&&!t.project?.completed_at&&`${t.title} ${t.project?.name}`.toLowerCase().includes(search));
 return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Archive</h1><p className="mt-2 text-sm text-gray-500">Archived work is read-only. Details, notes, files and history remain available.</p></div>
 <OverviewCards label="Archive overview" items={[
 {id:'archived',label:'Archived projects',value:archiveProjects.filter(p=>!p.completed_at).length,href:'/dashboard/archive#archive-projects',hint:'General archive'},
 {id:'done',label:'Completed projects',value:archiveProjects.filter(p=>Boolean(p.completed_at)).length,href:'/dashboard/archive?section=completed#archive-projects',hint:'Explicitly completed'},
 {id:'tasks',label:'Tasks in general archive',value:archiveTasks.length,href:'/dashboard/archive#archive-tasks',hint:'Includes archived projects'},
 ]}/>
 <nav aria-label="Archive sections" className="flex flex-wrap gap-3">{[['general','General archive'],['completed','Completed projects']].map(([id,label])=><Link key={id} aria-current={(completed?id==='completed':id==='general')?'page':undefined} className={`rounded-lg border px-4 py-2 ${completed===(id==='completed')?'bg-blue-600 text-white':''}`} href={`/dashboard/archive?section=${id}`}>{label}</Link>)}</nav>
 <form className="flex gap-2"><input type="hidden" name="section" value={completed?'completed':'general'}/><input name="q" aria-label="Search archive" defaultValue={query.q||''} placeholder="Search archived projects and tasks…" className="min-w-0 flex-1 rounded-lg border p-3"/><button className="rounded-lg border px-4">Search</button></form>
 {admin&&settingsResult.data&&<ArchiveSettings settings={settingsResult.data}/>}
 <section id="archive-projects" className="space-y-3"><h2 className="text-lg font-semibold">{completed?'Completed projects':'Archived projects'}</h2>{!projects.length&&<p className="text-sm text-gray-500">No matching projects in this section.</p>}{projects.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-surface p-4"><Link className="font-medium" href={`/dashboard/projects/${p.id}`}>{p.name}</Link><div className="text-sm text-gray-500">Archived {p.archived_at?new Date(p.archived_at).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'}):''}</div>{(admin||p.created_by===user.id)&&<ArchiveAction kind="project" id={p.id} archived/>}</div>)}</section>
 {!completed&&<section id="archive-tasks" className="space-y-3"><h2 className="text-lg font-semibold">Archived tasks</h2>{!tasks.length&&<p className="text-sm text-gray-500">No matching tasks in the archive.</p>}{tasks.map(t=><div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-surface p-4"><div><Link className="font-medium" href={`/dashboard/projects/${t.project_id}?task=${t.id}`}>{t.title}</Link><p className="text-sm text-gray-500">{t.project?.name}{t.project?.is_archived?' · Restore project first':''}</p></div>{!t.project?.is_archived&&(admin||t.created_by===user.id)&&<ArchiveAction kind="task" id={t.id} archived/>}</div>)}</section>}
 </div>;
}
