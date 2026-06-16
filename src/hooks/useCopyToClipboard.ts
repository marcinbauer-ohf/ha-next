'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Copy text to the clipboard with a transient `copied` flag for UI feedback
 * (e.g. swapping a copy glyph for a check). Reusable anywhere a value should be
 * copyable on click — falls back to a hidden-textarea + execCommand when the
 * async Clipboard API is unavailable (insecure context / older browsers).
 */
export function useCopyToClipboard(resetDelay = 1500): {
  copied: boolean;
  copy: (text: string) => Promise<void>;
} {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
        } catch {
          /* nothing else to try */
        }
        document.body.removeChild(ta);
      }
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetDelay);
    },
    [resetDelay],
  );

  return { copied, copy };
}
