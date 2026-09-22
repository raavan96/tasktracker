import WorkspaceHeading from '@/components/WorkspaceHeading';
import WorkspaceHistory from '@/components/WorkspaceHistory';
import {workspaceRead} from '@/lib/workspace-data';
export const dynamic='force-dynamic';
export default async function HistoryPage(){
 const data=await workspaceRead(async db=>{
  const items=(await db.query(`SELECT h.*,EXISTS(SELECT 1 FROM projects WHERE id=h.project_id) project_exists,EXISTS(SELECT 1 FROM tasks WHERE id=h.task_id) task_exists FROM workspace_history h ORDER BY h.created_at DESC,h.id DESC LIMIT 20`)).rows;
  const people=(await db.query('SELECT id,coalesce(full_name,email) name FROM profiles')).rows;
  return {items:items.map(item=>({...item,created_at:new Date(item.created_at).toISOString()})),people};
 });
 return <div className="space-y-5"><WorkspaceHeading className="text-2xl font-bold">History</WorkspaceHeading><p className="text-sm text-gray-500">Status updates, additions and edits — who changed what and when.</p><WorkspaceHistory items={data.items} people={data.people}/></div>;
}
