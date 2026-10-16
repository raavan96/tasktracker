'use client';

import { useEffect } from 'react';

export default function MyTasksHashScroll() {
  useEffect(() => {
    const handleScrollToHash = () => {
      const hash = window.location.hash;
      if (hash) {
        const id = hash.replace('#', '');
        const el = document.getElementById(id);
        if (el) {
          requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: 'smooth' });
          });
        }
      }
    };

    // Run on initial mount
    handleScrollToHash();

    // Also handle dynamic hash changes
    window.addEventListener('hashchange', handleScrollToHash);
    return () => window.removeEventListener('hashchange', handleScrollToHash);
  }, []);

  return null;
}
