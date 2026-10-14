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
    <div className="command-palette-trigger-wrap hidden sm:flex items-center">
      <button
        type="button"
        onClick={handleClick}
        className="command-palette-trigger flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs sm:text-sm font-medium transition"
      >
        <Search className="command-palette-trigger-icon h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="command-palette-trigger-label">Search or jump to…</span>
        <kbd className="command-palette-trigger-kbd ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider">
          {isMac ? '⌘K' : 'Ctrl+K'}
        </kbd>
      </button>
    </div>
  );
}
