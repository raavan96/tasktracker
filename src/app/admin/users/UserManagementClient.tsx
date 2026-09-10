'use client';

import { useState } from 'react';
import { createMember, resetMemberPassword, updateMemberDetails, updateUserRole, deleteUser } from '@/app/auth/actions';
import Modal from '@/components/Modal';
import { UserPlus, Trash2, Shield, User, Loader2 } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'member';
  created_at: string; job_title?: string; department?: string;
}

export default function UserManagementClient({
  users,
  currentUserId, counts,
}: {
  users: Profile[];
  currentUserId: string; counts: Record<string,number>;
}) {
  const [search, setSearch] = useState('');
  const [editMember, setEditMember] = useState<Profile | null>(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const filteredUsers = users.filter(u => `${u.full_name} ${u.email} ${u.job_title || ''} ${u.department || ''}`.toLowerCase().includes(search.toLowerCase()));
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string } | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsCreating(true);
    setFeedback(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      const res = await createMember(formData);
      if (res?.error) setFeedback({ error: res.error });
      if (res?.success) { setFeedback({ success: res.success }); form.reset(); }
    } catch { setFeedback({ error: 'Account creation could not be confirmed. Check the member list before retrying.' }); }
    finally { setIsCreating(false); }
  }

  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  async function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetTarget || resetBusy) return;
    setResetBusy(true); setFeedback(null);
    try {
      const result = await resetMemberPassword(resetTarget.id, new FormData(event.currentTarget));
      setFeedback(result);
      if (result.success) setResetTarget(null);
    } catch { setFeedback({ error: 'Password update could not be confirmed. Check your connection.' }); }
    finally { setResetBusy(false); }
  }

  async function handleRoleChange(userId: string, newRole: 'admin' | 'member') {
    setPendingActionId(userId);
    setFeedback(null);
    const res = await updateUserRole(userId, newRole);
    if (res?.error) setFeedback({ error: res.error });
    setPendingActionId(null);
  }

  async function handleDelete(userId: string) {
    if (!confirm('Are you sure you want to remove this user from the workspace?')) return;
    setPendingActionId(userId);
    setFeedback(null);
    const res = await deleteUser(userId);
    if (res?.error) setFeedback({ error: res.error });
    setPendingActionId(null);
  }

  return (
    <div className="space-y-8">
      {feedback?.error && (
        <div role="alert" className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
          {feedback.error}
        </div>
      )}
      {feedback?.success && (
        <div role="status" className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md">
          {feedback.success}
        </div>
      )}

      {/* Create Member Form */}
      <div className="bg-surface p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <UserPlus className="w-5 h-5 mr-2 text-blue-600" /> Create New Member
        </h2>
        <p className="mb-5 text-sm text-slate-600">Create an account with an initial password and share the login details privately. No invitation email is sent. Then open a project’s Team tab to add the member and assign tasks.</p>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="fullName" className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
            <input
              id="fullName" name="fullName"
              type="text"
              required
              placeholder="Jane Doe"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">Company Email</label>
            <input
              id="email" name="email"
              type="email"
              required
              placeholder={`name@${process.env.NEXT_PUBLIC_COMPANY_DOMAIN || 'company.com'}`}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="role" className="block text-xs font-medium text-gray-700 mb-1">Role</label>
            <select
              id="role" name="role"
              className="w-full px-3 py-2 border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-blue-500"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <PasswordFields />
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isCreating}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm flex items-center justify-center disabled:opacity-50"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Member'}
            </button>
          </div>
        </form>
      </div>

      {resetTarget && <section key={resetTarget.id} className="bg-surface p-6 rounded-xl border border-gray-200" aria-labelledby="reset-heading">
        <h2 id="reset-heading" className="text-lg font-semibold">Reset password for {resetTarget.full_name || resetTarget.email}</h2>
        <p className="my-2 text-sm text-gray-600">{resetTarget.email} will use this password for their next sign-in. Share it privately.</p>
        <form onSubmit={handleReset} className="grid gap-4 md:grid-cols-3">
          <PasswordFields prefix="reset-" />
          <div className="flex items-end gap-3">
            <button disabled={resetBusy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{resetBusy ? 'Saving…' : 'Save password'}</button>
            <button type="button" disabled={resetBusy} onClick={() => setResetTarget(null)} className="px-3 py-2 text-sm">Cancel</button>
          </div>
        </form>
      </section>}

      {editMember && <Modal title="Edit member details" busy={detailsBusy} onClose={() => setEditMember(null)}>
        {feedback?.error && <p role="alert" className="text-sm text-red-700">{feedback.error}</p>}
        <form className="space-y-4" onSubmit={async e => { e.preventDefault(); const form = new FormData(e.currentTarget); setDetailsBusy(true); setFeedback(null); try {const result=await updateMemberDetails(editMember.id,form);setFeedback(result);if(result.success)setEditMember(null);}catch{setFeedback({error:'Member could not be updated.'});}finally{setDetailsBusy(false);} }}>
          <p className="text-sm text-gray-500">{editMember.email}</p>
          <label className="block text-sm">Full name<input name="fullName" required maxLength={150} defaultValue={editMember.full_name || ''} className="mt-1 w-full rounded-lg border p-3" /></label>
          <label className="block text-sm">Job title<input name="jobTitle" maxLength={150} defaultValue={editMember.job_title || ''} className="mt-1 w-full rounded-lg border p-3" /></label>
          <label className="block text-sm">Department<input name="department" maxLength={150} defaultValue={editMember.department || ''} className="mt-1 w-full rounded-lg border p-3" /></label>
          <button disabled={detailsBusy} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Save details</button>
        </form>
      </Modal>}
      <input aria-label="Search members" placeholder="Search name, email, job title, or department" value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-lg border px-4 py-3 text-sm" />
      {/* User Roster */}
      <div className="bg-surface rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Current Members ({users.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-6 py-3 text-left font-medium">User</th>
                <th className="px-6 py-3 text-left font-medium">Role</th>
                <th className="px-6 py-3 text-left font-medium">Open tasks</th>
                <th className="px-6 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((u) => {
                const isSelf = u.id === currentUserId;
                const isPending = pendingActionId === u.id;

                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 flex items-center">
                        {u.full_name || 'Anonymous User'}
                        {isSelf && (
                          <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">You</span>
                        )}
                      </div>
                      <div className="text-gray-500 text-xs">{u.email}</div><div className="mt-1 text-xs text-gray-500">{[u.job_title,u.department].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {u.role === 'admin' ? <Shield className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {counts[u.id] || 0}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => { setFeedback(null); setEditMember(u); }} className="text-xs text-blue-700 font-medium">Edit details</button>
                      {!isSelf && (
                        <>
                          <button onClick={() => { setResetTarget(u); setFeedback(null); }} disabled={resetBusy} className="text-xs text-blue-600 font-medium disabled:opacity-50">Reset password</button>
                          <button
                            onClick={() => handleRoleChange(u.id, u.role === 'admin' ? 'member' : 'admin')}
                            disabled={isPending}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                          >
                            Make {u.role === 'admin' ? 'Member' : 'Admin'}
                          </button>
                          <details className="inline-block text-left"><summary className="cursor-pointer text-xs text-gray-500">More actions</summary><button
                            onClick={() => handleDelete(u.id)}
                            disabled={isPending}
                            className="text-xs text-red-600 hover:text-red-800 p-1 inline-flex items-center disabled:opacity-50"
                            title="Remove User"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />Remove member
                          </button></details>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PasswordFields({ prefix = '' }: { prefix?: string }) {
  return <>
    <div>
      <label htmlFor={`${prefix}password`} className="block text-xs font-medium text-gray-700 mb-1">Password (at least 8 characters)</label>
      <input id={`${prefix}password`} name="password" type="password" autoComplete="new-password" minLength={8} required className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
    </div>
    <div>
      <label htmlFor={`${prefix}confirmPassword`} className="block text-xs font-medium text-gray-700 mb-1">Confirm password</label>
      <input id={`${prefix}confirmPassword`} name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
    </div>
  </>;
}
