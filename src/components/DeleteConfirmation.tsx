'use client';

import { useState } from 'react';
import Modal from './Modal';

export default function DeleteConfirmation({ kind, name, onClose, onConfirm }: {
  kind: 'task' | 'project'; name: string; onClose: () => void;
  onConfirm: (confirmation: string) => Promise<{ error?: string }>;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || (kind === 'project' && confirmation !== name)) return;
    setBusy(true); setError('');
    try {
      const result = await onConfirm(confirmation);
      if (result.error) setError(result.error);
    } catch { setError('Deletion could not be confirmed. Refresh the page before trying again.'); }
    finally { setBusy(false); }
  }
  return <Modal title={`Delete ${kind}?`} busy={busy} onClose={onClose}>
    <form onSubmit={submit} className="space-y-5">
      <p className="break-words text-sm text-slate-700">You are deleting <strong>{name}</strong>.</p>
      <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {kind === 'project' ? 'This permanently deletes the project and its linked tasks, notes, comments, and project memberships.' : 'This permanently deletes the task and its linked comments.'} This cannot be undone.
      </p>
      {kind === 'project' && <label className="block text-sm font-medium text-slate-700">Type the project name to confirm
        <input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" disabled={busy} className="mt-2 w-full rounded-lg border px-3 py-2.5" />
      </label>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700">Cancel</button>
        <button type="submit" disabled={busy || (kind === 'project' && confirmation !== name)} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{busy ? 'Deleting…' : `Delete ${kind}`}</button>
      </div>
    </form>
  </Modal>;
}
