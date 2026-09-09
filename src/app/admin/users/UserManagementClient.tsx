'use client';

import { useState } from 'react';
import { inviteUser, updateUserRole, deleteUser } from '@/app/auth/actions';
import { UserPlus, Trash2, Shield, User, Loader2 } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'member';
  created_at: string;
}

export default function UserManagementClient({
  users,
  currentUserId,
}: {
  users: Profile[];
  currentUserId: string;
}) {
  const [isInviting, setIsInviting] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string } | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsInviting(true);
    setFeedback(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      const res = await inviteUser(formData);
      if (res?.error) setFeedback({ error: res.error });
      if (res?.success) { setFeedback({ success: res.success }); form.reset(); }
    } catch { setFeedback({ error: 'Invitation could not be confirmed. Check your connection and try again.' }); }
    finally { setIsInviting(false); }
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

      {/* Invite Form */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <UserPlus className="w-5 h-5 mr-2 text-blue-600" /> Invite New Member
        </h2>
        <p className="mb-5 text-sm text-slate-600">1. Send an invitation. 2. Your teammate sets a password from the email. 3. Open a project’s Team tab to add them and assign tasks.</p>
        <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isInviting}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm flex items-center justify-center disabled:opacity-50"
            >
              {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>

      {/* User Roster */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Current Members ({users.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-6 py-3 text-left font-medium">User</th>
                <th className="px-6 py-3 text-left font-medium">Role</th>
                <th className="px-6 py-3 text-left font-medium">Joined</th>
                <th className="px-6 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => {
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
                      <div className="text-gray-500 text-xs">{u.email}</div>
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
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {!isSelf && (
                        <>
                          <button
                            onClick={() => handleRoleChange(u.id, u.role === 'admin' ? 'member' : 'admin')}
                            disabled={isPending}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                          >
                            Make {u.role === 'admin' ? 'Member' : 'Admin'}
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            disabled={isPending}
                            className="text-xs text-red-600 hover:text-red-800 p-1 inline-flex items-center disabled:opacity-50"
                            title="Remove User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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