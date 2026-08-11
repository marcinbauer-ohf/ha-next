'use client';

// Small "edit the sidebar / bottom sheet contents" affordance — enters
// arrange (jiggle) mode without needing the long-press or context-menu
// gesture. One component, two skins: an icon tile for the desktop rail's
// bottom slot and a compact labeled chip for the mobile sheet header.

import { Icon } from './Icon';
import { mdiPencilOutline } from '@mdi/js';

interface EditItemsButtonProps {
  onClick: () => void;
  /** 'rail': square icon-only tile (desktop sidebar); 'bar': full-width
   *  bottom button (mobile sheet, mirrors the arrange-mode Done button). */
  variant?: 'rail' | 'bar';
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLButtonElement>;
}

export function EditItemsButton({
  onClick,
  variant = 'bar',
  onMouseEnter,
  onMouseLeave,
}: EditItemsButtonProps) {
  if (variant === 'rail') {
    return (
      <button
        type="button"
        aria-label="Edit sidebar"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="w-12 h-10 rounded-ha-xl transition-colors flex items-center justify-center text-text-tertiary hover:bg-surface-low hover:text-text-primary"
      >
        <Icon path={mdiPencilOutline} size={17} exact />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-11 rounded-ha-xl bg-surface-low text-text-secondary hover:text-text-primary text-sm font-semibold flex items-center justify-center gap-ha-2 active:scale-[0.98] transition-transform"
    >
      <Icon path={mdiPencilOutline} size={16} exact />
      Edit
    </button>
  );
}
