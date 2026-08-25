'use client';

// Small "edit the sidebar / bottom sheet contents" affordance — enters
// arrange (jiggle) mode without needing the long-press or context-menu
// gesture. One component, two skins: an icon tile for the desktop rail's
// bottom slot and a compact labeled chip for the mobile sheet header.

import { Button } from './Button';
import { IconButton } from './IconButton';
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
      <IconButton
        icon={mdiPencilOutline}
        label="Edit sidebar"
        tone="quiet"
        shape="square"
        exact
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );
  }

  return (
    <Button icon={mdiPencilOutline} onClick={onClick} block>
      Edit
    </Button>
  );
}
