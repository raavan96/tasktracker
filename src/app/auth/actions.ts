'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = formData.get('password') as string;
  const domain = process.env.NEXT_PUBLIC_COMPANY_DOMAIN;

  if (domain && domain !== '*' && !email.endsWith(`@${domain.toLowerCase()}`)) {
    return { error: `Only company emails ending with @${domain} are allowed.` };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') || '');
  const confirmPassword = formData.get('confirmPassword') as string;

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters long.' };
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in before changing your password. If you cannot sign in, contact your workspace admin.' };
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

function passwordError(formData: FormData) {
  const password = String(formData.get('password') || '');
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (password !== formData.get('confirmPassword')) return 'Passwords do not match.';
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in with an admin account.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return { error: 'Admin privileges required.' };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: 'User management is not configured. Check the server settings.' };
  return { user };
}

export async function createMember(formData: FormData) {
  const access = await requireAdmin();
  if (access.error) return { error: access.error };
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const fullName = String(formData.get('fullName') || '').trim();
  const role = String(formData.get('role') || 'member');
  const domain = process.env.NEXT_PUBLIC_COMPANY_DOMAIN;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter a valid email address.' };
  if (domain && domain !== '*' && !email.endsWith(`@${domain.toLowerCase()}`)) return { error: `Email must belong to @${domain}.` };
  if (!fullName) return { error: 'Enter the teammate’s full name.' };
  if (!['admin', 'member'].includes(role)) return { error: 'Choose a valid role.' };
  const validation = passwordError(formData);
  if (validation) return { error: validation };

  const admin = createAdminClient();
  // Server-only Admin API: auto-confirm the account without an invitation email.
  const { data, error } = await admin.auth.admin.createUser({
    email, password: String(formData.get('password')), email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) return { error: error.message };
  if (!data.user) return { error: 'Account creation could not be confirmed. Check the user list before retrying.' };
  // Ensure the roster exists whether or not an auth trigger creates profiles.
  // Authorization uses profiles.role, never user-editable metadata.
  const { error: profileError } = await admin.from('profiles').upsert({
    id: data.user.id, email, full_name: fullName, role,
  }, { onConflict: 'id' });
  revalidatePath('/admin/users');
  if (profileError) return { error: `The login for ${email} was created, but workspace setup failed. Ask the administrator to repair its profile in Supabase; do not create the account again.` };
  return { success: `Account created for ${email}. Share the login details privately, then add the member to a project’s Team tab.` };
}

export async function resetMemberPassword(userId: string, formData: FormData) {
  const access = await requireAdmin();
  if (access.error) return { error: access.error };
  if (userId === access.user?.id) return { error: 'Use Change password in the header for your own account.' };
  const validation = passwordError(formData);
  if (validation) return { error: validation };
  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('id').eq('id', userId).single();
  if (!profile) return { error: 'Workspace member not found.' };
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: String(formData.get('password')), email_confirm: true,
  });
  if (error) return { error: error.message };
  return { success: 'Password updated. Share the new password privately with the member.' };
}

export async function updateUserRole(userId: string, newRole: 'admin' | 'member') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();

  if (callerProfile?.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  if (user?.id === userId && newRole !== 'admin') {
    return { error: 'You cannot revoke your own admin rights.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  return { success: 'User role updated successfully.' };
}

export async function deleteUser(userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();

  if (callerProfile?.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  if (user?.id === userId) {
    return { error: 'You cannot delete your own account.' };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  return { success: 'User removed.' };
}

export async function updateMemberDetails(userId: string, formData: FormData) {
  const access = await requireAdmin();
  if (access.error) return { error: access.error };
  const full_name = String(formData.get('fullName') || '').trim();
  const job_title = String(formData.get('jobTitle') || '').trim();
  const department = String(formData.get('department') || '').trim();
  if (!full_name || full_name.length > 150 || job_title.length > 150 || department.length > 150) return { error: 'Name is required; each field may contain up to 150 characters.' };
  const { data, error } = await createAdminClient().from('profiles').update({full_name,job_title,department}).eq('id',userId).select('id').single();
  if(error || !data)return {error:error?.message || 'Member not found.'};
  revalidatePath('/admin/users'); revalidatePath('/dashboard','layout');
  return {success:'Member details updated.'};
}
