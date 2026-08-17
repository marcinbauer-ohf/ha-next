'use client';

import { useEffect, useState } from 'react';

/** Columns the device-card masonry runs at. Desktop packs four narrower cards
    across; below lg it stays at two. Edit mode and the loading skeleton read
    the same number, so entering/leaving either never reflows the layout. */
export const MASONRY_COLS_DESKTOP = 4;
export const MASONRY_COLS_MOBILE = 2;

/** Tailwind class for the same split, for the places that lay the cards out as
    a real CSS grid (edit mode) rather than flex columns. */
export const MASONRY_GRID_CLASS = 'grid-cols-2 lg:grid-cols-4';

export function useMasonryCols() {
  const [cols, setCols] = useState(MASONRY_COLS_MOBILE);
  useEffect(() => {
    const update = () =>
      setCols(window.innerWidth >= 1024 ? MASONRY_COLS_DESKTOP : MASONRY_COLS_MOBILE);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return cols;
}
