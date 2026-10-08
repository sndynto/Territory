'use client';

import { useEffect } from 'react';

export function SecurityBlocker() {
  useEffect(() => {
    // Only block in production
    if (process.env.NODE_ENV !== 'production') return;

    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const blockKeys = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
      }
      // Ctrl+Shift+I / Cmd+Option+I (Inspect)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
      }
      // Ctrl+Shift+J / Cmd+Option+J (Console)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
      }
      // Ctrl+U / Cmd+Option+U (View Source)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault();
      }
      // Ctrl+Shift+C / Cmd+Shift+C (Inspect Element selection tool)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('keydown', blockKeys);

    // Some rudimentary devtools open detection via debugger statement loop
    // (Disabled because it causes lag, basic key/click blocking is enough for typical users)

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('keydown', blockKeys);
    };
  }, []);

  return null;
}
