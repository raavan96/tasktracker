'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import Modal from './Modal';

const presets = {
  Charcoal: 'linear-gradient(135deg,#959ca4,#68717c)',
  Aurora: 'radial-gradient(ellipse at 15% 90%,#ff976980,transparent 55%),radial-gradient(ellipse at 85% 15%,#887afa,transparent 60%),linear-gradient(140deg,#2543a4,#123659 55%,#457b92)',
  Coast: 'radial-gradient(ellipse at 20% 100%,#f0d7af,transparent 60%),radial-gradient(ellipse at 90% 0%,#84e3e6,transparent 60%),linear-gradient(140deg,#30679e,#358594 60%,#8eaea7)',
  Dusk: 'radial-gradient(ellipse at 80% 95%,#e3a37b,transparent 55%),radial-gradient(ellipse at 20% 15%,#ac88d5,transparent 60%),linear-gradient(150deg,#392d68,#6e5a96 55%,#ac7599)',
};
type Appearance = { preset: keyof typeof presets; image: string | null; dim: number; transparency: number; opaque: boolean };
const defaults: Appearance = { preset: 'Charcoal', image: null, dim: 22, transparency: 0, opaque: false };
export default function WorkspaceAppearance({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Appearance>(defaults);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const current = useRef(defaults);
  const generation = useRef(0);
  const key = `tasktracker-appearance-v1:${userId}`;
  function apply(next: Appearance) {
    current.current = next;
    const root = document.documentElement;
    root.style.setProperty('--user-wallpaper', next.image ? `url("${next.image}")` : presets[next.preset]);
    root.style.setProperty('--wallpaper-brightness', String(1 - next.dim / 150));
    root.dataset.opaqueGlass = String(next.opaque);
    root.style.setProperty('--window-opacity', String(1 - next.transparency / 100));
  }
  useEffect(() => {
    let next = defaults;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved && Object.hasOwn(presets, saved.preset)) next = {
        preset: saved.preset,
        image: typeof saved.image === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(saved.image) && saved.image.length < 4000000 ? saved.image : null,
        dim: Number.isFinite(saved.dim) ? Math.max(0, Math.min(70, saved.dim)) : 22,
        transparency: Number.isFinite(saved.transparency) ? Math.max(0, Math.min(40, saved.transparency)) : defaults.transparency,
        opaque: saved.opaque === true,
      };
    } catch { /* Browsers may disable storage. The default remains usable. */ }
    apply(next);
    // Load the saved appearance only after hydration; no server access to localStorage.
    const timer = setTimeout(() => setValue(next), 0);
    // Invalidate pending image decoding when the workspace unmounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { clearTimeout(timer); generation.current++; document.documentElement.style.removeProperty('--user-wallpaper'); document.documentElement.style.removeProperty('--wallpaper-brightness'); document.documentElement.style.removeProperty('--window-opacity'); delete document.documentElement.dataset.opaqueGlass; };
  }, [key]);
  function update(next: Appearance) {
    apply(next); setValue(next);
    try { localStorage.setItem(key, JSON.stringify(next)); setMessage('Saved for your account in this browser.'); }
    catch { setMessage('Applied for this visit. Browser storage is unavailable or full.'); }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setMessage('Choose a JPG, PNG or WebP image under 10 MB.'); return; }
    const run = ++generation.current; setBusy(true); setMessage('Preparing background…');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (image.width * image.height > 60000000) throw new Error('Too large');
      const scale = Math.min(1, 1920 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d'); if (!context) throw new Error('No canvas');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      if (generation.current === run) update({ ...current.current, image: canvas.toDataURL('image/jpeg', .8) });
    } catch { if (generation.current === run) setMessage('Could not read this image. Try another JPG, PNG or WebP.'); }
    finally { URL.revokeObjectURL(url); if (generation.current === run) setBusy(false); }
  }
  return <>
    <button type="button" className="appearance-trigger rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label="Customize background" onClick={() => setOpen(true)}><ImagePlus aria-hidden="true" className="h-5 w-5" /></button>
    {open && <Modal title="Personalize your workspace" busy={busy} onClose={() => setOpen(false)}>
      <div data-instant-save className="space-y-5">
        <p className="text-sm text-gray-600">Choose a backdrop for your workspace, or use your own photo.</p>
        <div className="wallpaper-presets">{Object.entries(presets).map(([name, background]) => <button key={name} type="button" disabled={busy} aria-pressed={!value.image && value.preset === name} style={{ background }} onClick={() => update({ ...value, image: null, preset: name as keyof typeof presets })}><span>{name}</span></button>)}</div>
        <label className="block text-sm font-medium">Background image<input className="mt-2 block w-full rounded-lg border p-2 text-sm" aria-label="Background image" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} /></label>
        <p className="text-sm text-gray-600">JPG, PNG or WebP · up to 10 MB. Stored only in this browser for your account; not uploaded to the server or shared with teammates.</p>
        <label className="flex flex-wrap items-center justify-between gap-3 text-sm">Background dimming<input aria-label="Background dimming" type="range" min="0" max="70" value={value.dim} onChange={e => update({ ...value, dim: Number(e.target.value) })} /></label>
        <div className="space-y-2"><label className="flex flex-wrap items-center justify-between gap-3 text-sm">Window transparency <span className="tabular-nums">{value.opaque ? '0% (reduced transparency)' : `${value.transparency}%`}</span><input className="w-full" aria-label="Window transparency" type="range" min="0" max="40" step="5" disabled={value.opaque} value={value.transparency} onChange={e => update({...value,transparency:Number(e.target.value)})} /></label><p className="text-xs text-gray-600">0% is solid. Higher values reveal more wallpaper. Task cards and forms stay solid for readability.</p></div>
        <label className="flex items-center justify-between gap-3 text-sm">Reduce transparency<input type="checkbox" checked={value.opaque} onChange={e => update({ ...value, opaque: e.target.checked })} /></label>
        <button type="button" className="rounded-full border px-4 py-2 text-sm" disabled={busy} onClick={() => update(defaults)}>Reset background</button>
        <p role="status" className="text-sm text-gray-600">{message}</p>
      </div>
    </Modal>}
  </>;
}
