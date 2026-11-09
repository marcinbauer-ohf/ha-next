import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/**
 * A DOM node owned by another part of the shell (a portal slot), looked up by
 * id. Null on the server and until the node is in the document.
 */
export function useElementById(id: string): HTMLElement | null {
  return useSyncExternalStore(noop, () => document.getElementById(id), () => null);
}
