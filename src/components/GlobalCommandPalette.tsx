'use client';

import { useState, useEffect } from 'react';
import CommandPalette from './CommandPalette';
import DailyStandupModal from './DailyStandupModal';

interface GlobalCommandPaletteProps {
  isAdmin: boolean;
}

export default function GlobalCommandPalette({ isAdmin }: GlobalCommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isStandupOpen, setIsStandupOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd + K or Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    const handleOpenCommandPalette = () => {
      setIsOpen(true);
    };

    const handleOpenStandup = () => {
      setIsStandupOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('tasktracker:open-command-palette', handleOpenCommandPalette);
    window.addEventListener('tasktracker:open-standup', handleOpenStandup);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('tasktracker:open-command-palette', handleOpenCommandPalette);
      window.removeEventListener('tasktracker:open-standup', handleOpenStandup);
    };
  }, []);

  return (
    <>
      {isOpen && (
        <CommandPalette
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          isAdmin={isAdmin}
          onOpenStandup={() => setIsStandupOpen(true)}
        />
      )}

      {isStandupOpen && <DailyStandupModal onClose={() => setIsStandupOpen(false)} />}
    </>
  );
}
