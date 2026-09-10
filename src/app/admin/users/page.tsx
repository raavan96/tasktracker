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

  const { data: assignments, error: assignmentError } = await supabase.from('tasks').select('assignee_id,status,project:projects!inner(is_archived)').eq('project.is_archived',false);
  if (assignmentError) throw new Error('Assigned task counts could not load. Please retry.');
  const counts: Record<string,number> = {};
  for (const task of assignments || []) if (task.assignee_id && task.status !== 'done') counts[task.assignee_id] = (counts[task.assignee_id] || 0) + 1;

  return (
    <div className="w-full space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
        <p className="text-sm text-gray-500">Create team accounts and reset passwords, manage permissions, and assign roles.</p>
      </div>
      <UserManagementClient counts={counts} users={profiles || []} currentUserId={user.id} />
    </div>
  );
}