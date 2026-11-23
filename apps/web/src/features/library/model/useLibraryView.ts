import { useState } from 'react';

export type LibraryView = 'grid' | 'list';
const KEY = 'libify.libraryView';

function readView(): LibraryView {
  try {
    return localStorage.getItem(KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

/** Grid (default) or list layout of My Books, remembered on this device. */
export function useLibraryView(): [LibraryView, (view: LibraryView) => void] {
  const [view, setView] = useState<LibraryView>(readView);
  const update = (next: LibraryView) => {
    setView(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the choice lasts for this visit.
    }
  };
  return [view, update];
}
