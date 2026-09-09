'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function signIn(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
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

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const domain = process.env.NEXT_PUBLIC_COMPANY_DOMAIN;

  if (domain && domain !== '*' && !email.endsWith(`@${domain.toLowerCase()}`)) {
    return { error: `Email must belong to @${domain}` };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: 'Password reset instructions have been sent to your email.' };
}

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters long.' };
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function inviteUser(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();

  if (callerProfile?.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const fullName = (formData.get('fullName') as string)?.trim();
  const role = (formData.get('role') as 'admin' | 'member') || 'member';
  const domain = process.env.NEXT_PUBLIC_COMPANY_DOMAIN;

  if (domain && domain !== '*' && !email.endsWith(`@${domain.toLowerCase()}`)) {
    return { error: `Invitations must be sent to @${domain} addresses.` };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin/users');
  return { success: `Invitation sent to ${email}` };
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