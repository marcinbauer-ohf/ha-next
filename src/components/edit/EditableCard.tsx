'use client';

import { useState, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { mdiClose, mdiDragVariant, mdiArrowExpandHorizontal, mdiArrowCollapseHorizontal, mdiEyeOff, mdiEye } from '@mdi/js';
import type { CardColSpan, CardRowSpan } from '@/hooks/useDashboardLayout';

interface EditableCardProps {
  cardId: string;
  sectionId: string;
  colSpan: CardColSpan;
  rowSpan: CardRowSpan;
  isEditing: boolean;
  isHidden?: boolean;
  onToggleHidden: () => void;
  onResize: (colSpan: CardColSpan, rowSpan: CardRowSpan) => void;
  onDragStart: (cardId: string, sectionId: string) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, cardId: string, sectionId: string) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, cardId: string, sectionId: string) => void;
  children: ReactNode;
}

export function EditableCard({
  cardId,
  sectionId,
  colSpan,
  rowSpan,
  isEditing,
  isHidden = false,
  onToggleHidden,
  onResize,
  onDragStart,
  onDragOver,
  onDrop,
  children,
}: EditableCardProps) {
  const [isDragging, setIsDragging] = useState(false);

  const colClass = colSpan === 2 ? 'col-span-2' : 'col-span-1';
  const rowClass = rowSpan === 2 ? 'row-span-2' : 'row-span-1';

  return (
    <motion.div
      layout
      className={`relative ${colClass} ${rowClass} ${isEditing ? 'z-10 hover:z-20' : ''}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      {/* Card content — dimmed when hidden */}
      <div
        className={`h-full transition-opacity duration-150 ${isHidden ? 'opacity-30' : ''}`}
        draggable={isEditing && !isHidden}
        onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
          if (isHidden) return;
          setIsDragging(true);
          onDragStart(cardId, sectionId);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => setIsDragging(false)}
        onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          onDragOver(e, cardId, sectionId);
        }}
        onDrop={(e: React.DragEvent<HTMLDivElement>) => onDrop(e, cardId, sectionId)}
      >
        {children}
      </div>

      {isEditing && (
        <>
          {/* Hide/restore toggle — top-left */}
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
            aria-label={isHidden ? 'Show card' : 'Hide card'}
            className={`absolute top-1.5 left-1.5 z-30 w-6 h-6 rounded-full flex items-center justify-center shadow-lg ${
              isHidden
                ? 'bg-surface-mid text-text-secondary'
                : 'bg-gray-900 text-white'
            }`}
          >
            <Icon path={isHidden ? mdiEye : mdiEyeOff} size={14} />
          </motion.button>

          {/* Drag handle — top-right (only when visible) */}
          {!isHidden && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.15, delay: 0.03 }}
              className="absolute top-1.5 right-1.5 z-30 w-6 h-6 rounded-full bg-black/20 text-white flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing backdrop-blur-sm"
            >
              <Icon path={mdiDragVariant} size={14} />
            </motion.div>
          )}

          {/* Resize toggle — bottom-right (only when visible) */}
          {!isHidden && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.15, delay: 0.06 }}
              onClick={(e) => { e.stopPropagation(); onResize(colSpan === 2 ? 1 : 2, rowSpan); }}
              aria-label={colSpan === 2 ? 'Make card narrower' : 'Make card wider'}
              className="absolute bottom-1.5 right-1.5 z-30 w-7 h-7 rounded-full bg-black/20 text-white flex items-center justify-center shadow-md backdrop-blur-sm"
            >
              <Icon
                path={colSpan === 2 ? mdiArrowCollapseHorizontal : mdiArrowExpandHorizontal}
                size={14}
              />
            </motion.button>
          )}
        </>
      )}
    </motion.div>
  );
}
