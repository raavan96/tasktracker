import {assignedIds} from '@/lib/task-types';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import UserManagementClient from './UserManagementClient';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: assignments, error: assignmentError } = await supabase.from('tasks').select('assignee_id,assignee_ids,status,project:projects!inner(is_archived)').eq('project.is_archived',false).eq('is_archived',false);
  if (assignmentError) throw new Error('Assigned task counts could not load. Please retry.');
  const counts: Record<string,number> = {};
  for (const task of assignments || []) if(task.status!=='done') for(const id of assignedIds(task))counts[id]=(counts[id]||0)+1;

  const {data:reviewSettings,error:policyError}=await supabase.from('review_settings').select('enabled').single();
  if(policyError)throw new Error('Review policy could not load.');
  return (
    <div className="w-full space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
        <p className="text-sm text-gray-500">Create team accounts and reset passwords, manage permissions, and assign roles.</p>
      </div>
      <UserManagementClient reviewEnabled={!!reviewSettings?.enabled} counts={counts} users={profiles || []} currentUserId={user.id} />
    </div>
  );
}