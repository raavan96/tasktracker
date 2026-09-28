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
    let pressTimer: ReturnType<typeof setTimeout> | undefined;
    let pressed: HTMLElement | null = null;
    let longPressed = false;
    let origin = {x:0,y:0};
    function cancelPress(){clearTimeout(pressTimer);pressTimer=undefined;}
    function press(e: PointerEvent){
      cancelPress();hide();longPressed=false;
      pressed=e.pointerType==='touch'&&e.target instanceof Element?e.target.closest<HTMLElement>('.workspace-nav-stack a'):null;
      if(!pressed)return;origin={x:e.clientX,y:e.clientY};
      pressTimer=setTimeout(()=>{longPressed=true;show(pressed);},500);
    }
    function move(e: PointerEvent){if(Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>10){cancelPress();if(longPressed)hide();longPressed=false;pressed=null;}}
    function release(){cancelPress();}
    function cancelTouch(){cancelPress();hide();longPressed=false;pressed=null;}
    function context(e: MouseEvent){if(pressed&&longPressed)e.preventDefault();}
    function click(e: MouseEvent){
      if(longPressed&&pressed&&e.target instanceof Node&&pressed.contains(e.target)){e.preventDefault();e.stopPropagation();longPressed=false;pressed=null;return;}
      hide();
    }
    document.addEventListener('pointerdown',press);document.addEventListener('pointermove',move);document.addEventListener('pointerup',release);document.addEventListener('pointercancel',cancelTouch);document.addEventListener('contextmenu',context);document.addEventListener('click',click,true);
    function over(e: PointerEvent) { if (e.pointerType !== 'touch') show(e.target); }
    function out(e: PointerEvent) { if (e.pointerType !== 'touch' && target && !(e.relatedTarget instanceof Node && target.contains(e.relatedTarget))) hide(); }
    function focus(e: FocusEvent) { show(e.target); }
    function scroll(){const focused=document.activeElement;if(target===focused)show(focused);else hide();}
    function key(e: KeyboardEvent) { if (e.key === 'Escape') hide(); }
    document.addEventListener('pointerover', over); document.addEventListener('pointerout', out); document.addEventListener('focusin', focus); document.addEventListener('focusout', hide); document.addEventListener('keydown', key);  document.addEventListener('scroll', scroll, true); window.addEventListener('resize', hide);
    return () => { cancelPress();document.removeEventListener('pointerdown',press);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',release);document.removeEventListener('pointercancel',cancelTouch);document.removeEventListener('contextmenu',context);document.removeEventListener('click',click,true);hide(); tip.remove(); document.removeEventListener('pointerover', over); document.removeEventListener('pointerout', out); document.removeEventListener('focusin', focus); document.removeEventListener('focusout', hide); document.removeEventListener('keydown', key);  document.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', hide); };
  }, []);
  return null;
}
