'use client';

import { Children, isValidElement, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { SectionLabel } from './SectionLabel';

/** Drag payload type — scopes list drags so they can't be confused with other DnD. */
const DRAG_MIME = 'text/ha-list-item';

interface ListSectionProps {
  /** Usually a string; a node lets a group prefix its heading with an icon. */
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /**
   * Pin the title to the top of the scroll container while its rows scroll
   * under it. For long lists inside a scrollport (the dialog's device list),
   * where losing the heading means losing track of which group you're in.
   */
  stickyTitle?: boolean;
  /**
   * Turn the rows into drag handles and accept drops. `fromId` is the dragged
   * row's key, `beforeId` the key of the row it should land above (null = end of
   * the list). A row dragged from another ListSection reports its own key, so
   * one handler covers reordering *and* moving between lists.
   */
  onReorder?: (fromId: string, beforeId: string | null) => void;
  /**
   * Classes for the card itself rather than the section — pass a height plus
   * `overflow-y-auto` and the rows scroll *inside* the card, so its corners and
   * edges stay put instead of sliding up the scrollport with the content.
   */
  bodyClassName?: string;
  /** The card element — for a scrolling body, whatever measures its scroll. */
  bodyRef?: React.Ref<HTMLDivElement>;
}

/**
 * React prefixes explicit list keys with `.$` — `.$sensor.foo` is the row's own
 * id. Children without a key of their own (an empty-state message, a footer)
 * come back as `.0` and stay put: only keyed rows are draggable.
 */
function keyOf(child: React.ReactNode): string | null {
  if (!isValidElement(child) || child.key == null) return null;
  const key = String(child.key);
  return key.startsWith('.$') ? key.slice(2) : null;
}

/**
 * Reusable grouped list container — same pattern as settings profile sections.
 * Wrap list rows (anchor tags, divs, buttons) as direct children;
 * they get automatic divider borders via CSS sibling selectors.
 *
 * The title is inset to the rows' own padding, so the heading and the row text
 * share one left edge instead of the heading hanging off toward the card corner.
 *
 * Pass `onReorder` and the list becomes rearrangeable: rows drag, a blue line
 * marks where the row would land, and the card (never the heading) lights up
 * while a drag hovers it. Every list in the app gets the same behaviour from the
 * same place — no per-screen drag code.
 */
export function ListSection({ title, children, className, stickyTitle, onReorder, bodyClassName, bodyRef }: ListSectionProps) {
  // Which row the drop would land above (null = nothing, '' = past the last row).
  const [insertBefore, setInsertBefore] = useState<string | null>(null);

  const rows = onReorder ? Children.toArray(children) : null;

  const clearDrag = () => setInsertBefore(null);

  // A section only ever clears its own highlight on its own drop or on one of
  // its rows' dragend — so a drag that crossed this list and landed somewhere
  // else (or was cancelled) left the blue landing line behind for good. An
  // empty section has no rows to fire dragend at all, so its line was
  // permanent. The drag is a global gesture, so listen for the global end.
  useEffect(() => {
    if (insertBefore === null) return;
    const clear = () => setInsertBefore(null);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, [insertBefore]);

  const dropAt = (e: React.DragEvent, beforeId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const fromId = e.dataTransfer.getData(DRAG_MIME);
    clearDrag();
    if (fromId) onReorder?.(fromId, beforeId);
  };

  return (
    <div className={clsx('space-y-ha-2', className)}>
      {title && (
        <SectionLabel
          inset
          // The backdrop has to be opaque and the label needs its own padding,
          // or rows would slide visibly *through* the text. `bg-inherit` takes
          // whatever ground the list is sitting on — hard-coding a surface token
          // painted a grey band wherever the container used a different one.
          className={stickyTitle ? 'sticky top-0 z-10 -mt-ha-1 py-ha-2 bg-inherit' : undefined}
        >
          {title}
        </SectionLabel>
      )}
      <div
        ref={bodyRef}
        // The drop highlight lives on the card, not the heading — the card is
        // the thing you're dropping into.
        className={clsx(
          'bg-surface-default rounded-ha-2xl border overflow-hidden transition-colors',
          '[&>*]:border-b [&>*]:border-surface-lower [&>*:last-child]:border-0',
          insertBefore !== null ? 'border-ha-blue' : 'border-surface-lower',
          bodyClassName,
        )}
        onDragOver={onReorder ? (e) => { e.preventDefault(); setInsertBefore(prev => prev ?? ''); } : undefined}
        onDragLeave={onReorder ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) clearDrag(); } : undefined}
        onDrop={onReorder ? (e) => dropAt(e, null) : undefined}
      >
        {rows
          ? rows.map((child, i) => {
              const id = keyOf(child);
              return (
                <div
                  key={id ?? i}
                  draggable={!!id}
                  onDragStart={(e) => {
                    if (!id) return;
                    e.dataTransfer.setData(DRAG_MIME, id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={clearDrag}
                  // A keyless child (an empty-state hint, a footer) isn't a
                  // landing spot of its own — hovering it means "into this
                  // list", i.e. past the last row.
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setInsertBefore(id ?? ''); }}
                  onDrop={(e) => dropAt(e, id)}
                  // Landing line on the row you'd drop above; the last row also
                  // carries the "past the end" line on its bottom edge.
                  // `id` is null for keyless children and `insertBefore` starts
                  // null — comparing the two painted a landing line on every
                  // empty section's hint before any drag began.
                  className={clsx(
                    'transition-[box-shadow]',
                    id !== null && insertBefore === id && 'shadow-[inset_0_2px_0_0_var(--color-ha-blue)]',
                  )}
                >
                  {child}
                </div>
              );
            })
          : children}
        {rows && insertBefore === '' && (
          <div aria-hidden className="h-0.5 bg-ha-blue" />
        )}
      </div>
    </div>
  );
}
