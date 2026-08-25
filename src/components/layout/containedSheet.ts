'use client';

import { createContext, useContext } from 'react';

/**
 * True inside a ModalSheet that rendered as the panel-contained sheet — the
 * bento surface bounded by the dashboard panel rather than the centered card.
 * Its own `max-height` already bounds the content, so anything inside that
 * normally pins itself to a fixed dialog height (DialogFrame) should let the
 * sheet size to the content instead of leaving dead space under it.
 */
export const ContainedSheetContext = createContext(false);

export const useContainedSheet = () => useContext(ContainedSheetContext);
