'use client';

import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { mdiPlus } from '@mdi/js';

interface AddCardTileProps {
  onClick: () => void;
}

export function AddCardTile({ onClick }: AddCardTileProps) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      aria-label="Add card"
      className="col-span-1 flex flex-col items-center justify-center gap-ha-2 p-ha-3 rounded-ha-xl border-2 border-dashed border-surface-mid text-text-tertiary hover:border-ha-blue hover:text-ha-blue transition-colors min-h-[60px]"
    >
      <Icon path={mdiPlus} size={24} />
      <span className="text-xs font-medium">Add card</span>
    </motion.button>
  );
}
