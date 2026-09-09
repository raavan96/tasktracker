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

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
        <p className="text-sm text-gray-500">Invite new team members, manage permissions, and assign roles.</p>
      </div>
      <UserManagementClient users={profiles || []} currentUserId={user.id} />
    </div>
  );
}