'use client';

import { createContext, useContext } from 'react';

/**
 * The shell's left rail slot — a grid column between the app sidebar and the
 * content surface that spans the top-bar row as well, so a route's secondary
 * nav can start level with the global search instead of below it.
 *
 * AppShell owns the column (and its width); a route fills it by portalling into
 * this node. Null until the shell has committed the slot to the DOM, and on
 * every route that doesn't use one.
 */
export const RailSlotContext = createContext<HTMLElement | null>(null);

export const useRailSlot = () => useContext(RailSlotContext);
