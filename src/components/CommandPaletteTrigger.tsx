'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';

export default function CommandPaletteTrigger() {
  const [isMac] = useState(() => {
    if (typeof navigator !== 'undefined') {
      return /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent);
    }
    return true;
  });

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('tasktracker:open-command-palette'));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Search or run command (Press Cmd+K to open)"
      className="command-palette-trigger flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs sm:text-sm font-medium transition"
    >
      <Search className="command-palette-trigger-icon h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="hidden md:inline command-palette-trigger-label">Search or jump to…</span>
      <span className="md:hidden command-palette-trigger-label">Search…</span>
      <kbd className="command-palette-trigger-kbd ml-1 hidden rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider sm:inline-block">
        {isMac ? '⌘K' : 'Ctrl+K'}
      </kbd>
    </button>
  );
}
