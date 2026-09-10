'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, busy = false, side = false, children }: {
  title: string; onClose: () => void; busy?: boolean; side?: boolean; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [dirty, setDirty] = useState(false);
  function close() {
    if (!busy && (!dirty || window.confirm('Discard your unsaved changes?'))) onClose();
  }
  useEffect(() => {
    const dialog = ref.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  return <dialog ref={ref} className={`task-dialog ${side ? 'task-drawer' : ''}`} aria-labelledby={headingId}
    onChangeCapture={() => setDirty(true)}
    onClick={(event) => { if (event.target === ref.current) { const bounds = ref.current.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close(); } }}
    onCancel={(event) => { event.preventDefault(); close(); }}>
    <div className="mb-5 flex items-start justify-between gap-4">
      <h2 id={headingId} className="text-xl font-semibold break-words min-w-0">{title}</h2>
      <button type="button" disabled={busy} onClick={close} aria-label="Close dialog" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
    </div>
    {children}
  </dialog>;
}
