'use client';
import { useEffect } from 'react';

/** One tooltip above the glass stacking layers, including native dialogs. */
export default function WorkspaceTooltips() {
  useEffect(() => {
    const tip = document.createElement('div'); tip.id = 'workspace-control-tooltip'; tip.className = 'workspace-tooltip'; tip.role = 'tooltip'; tip.hidden = true;
    document.body.append(tip);
    let target: HTMLElement | null = null;
    function hide() {
      if (target) { const ids = (target.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== tip.id); if (ids.length) target.setAttribute('aria-describedby', ids.join(' ')); else target.removeAttribute('aria-describedby'); }
      tip.hidden = true; target = null;
    }
    function show(element: EventTarget | null) {
      const button = element instanceof Element ? element.closest<HTMLElement>('[data-tooltip],button[aria-label],a[aria-label]') : null;
      if (!button) { hide(); return; }
      const label = button.dataset.tooltip || button.getAttribute('aria-label'); if (!label) return;
      hide(); target = button; tip.textContent = label; (button.closest('dialog') || document.body).append(tip); tip.hidden = false;
      button.setAttribute('aria-describedby', [button.getAttribute('aria-describedby'), tip.id].filter(Boolean).join(' '));
      const r = button.getBoundingClientRect(), t = tip.getBoundingClientRect();
      const rail = button.closest('.dark-workspace-sidebar');
      let top = rail ? r.top + (r.height - t.height) / 2 : r.bottom + 8;
      if (top + t.height > innerHeight - 12) top = r.top - t.height - 8;
      tip.style.top = `${Math.max(12, top)}px`; tip.style.left = `${Math.max(12, Math.min(rail ? r.right + 12 : r.left + (r.width - t.width) / 2, innerWidth - t.width - 12))}px`;
    }
    function over(e: PointerEvent) { if (e.pointerType !== 'touch') show(e.target); }
    function out(e: PointerEvent) { if (target && !(e.relatedTarget instanceof Node && target.contains(e.relatedTarget))) hide(); }
    function focus(e: FocusEvent) { show(e.target); }
    function key(e: KeyboardEvent) { if (e.key === 'Escape') hide(); }
    document.addEventListener('pointerover', over); document.addEventListener('pointerout', out); document.addEventListener('focusin', focus); document.addEventListener('focusout', hide); document.addEventListener('keydown', key); document.addEventListener('click', hide); document.addEventListener('scroll', hide, true); window.addEventListener('resize', hide);
    return () => { hide(); tip.remove(); document.removeEventListener('pointerover', over); document.removeEventListener('pointerout', out); document.removeEventListener('focusin', focus); document.removeEventListener('focusout', hide); document.removeEventListener('keydown', key); document.removeEventListener('click', hide); document.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide); };
  }, []);
  return null;
}
