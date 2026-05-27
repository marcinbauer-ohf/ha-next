'use client';

import { use, useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ApplicationViewNotice } from '@/components/layout/ApplicationViewNotice';
import { PullToRevealPanel } from '@/components/sections';
import { EditableCard } from '@/components/edit/EditableCard';
import { AddCardTile } from '@/components/edit/AddCardTile';
import { CardPickerSheet } from '@/components/edit/CardPickerSheet';
import { EntityCard } from '@/components/cards';
import { useDesktopImmersivePageLayout, useSidebarItems, useDashboardLayout } from '@/hooks';
import { useHomeAssistantEntities } from '@/hooks/useHomeAssistant';
import { usePullToRevealContext, useHeader, useEditMode } from '@/contexts';
import {
  mdiLightbulb,
  mdiLightbulbOutline,
  mdiToggleSwitchOutline,
  mdiThermometer,
  mdiSpeaker,
  mdiFlash,
  mdiWaterPercent,
  mdiGauge,
  mdiEye,
  mdiFan,
  mdiLock,
  mdiRobot,
  mdiDevices,
} from '@mdi/js';
import type { HassEntity } from '@/types';
import type { CardConfig, SectionConfig } from '@/hooks/useDashboardLayout';

interface DashboardPageProps {
  params: Promise<{ slug: string }>;
}

// ── Entity display helpers ───────────────────────────────────────────────────

function entityDomain(entity: HassEntity) {
  return entity.entity_id.split('.')[0];
}

function friendlyName(entity: HassEntity): string {
  return (entity.attributes.friendly_name as string | undefined) ?? entity.entity_id.split('.')[1];
}

function stateLabel(entity: HassEntity): string {
  const s = entity.state;
  const unit = entity.attributes.unit_of_measurement as string | undefined;
  return unit ? `${s} ${unit}` : s.charAt(0).toUpperCase() + s.slice(1);
}

function iconForEntity(entity: HassEntity): string {
  const domain = entityDomain(entity);
  const dc = entity.attributes.device_class as string | undefined;
  const on = !['off', 'unavailable', 'unknown'].includes(entity.state.toLowerCase());

  if (domain === 'light') return on ? mdiLightbulb : mdiLightbulbOutline;
  if (domain === 'switch') return mdiToggleSwitchOutline;
  if (domain === 'climate') return mdiThermometer;
  if (domain === 'media_player') return mdiSpeaker;
  if (domain === 'fan') return mdiFan;
  if (domain === 'lock') return mdiLock;
  if (domain === 'vacuum') return mdiRobot;
  if (domain === 'sensor') {
    if (dc === 'temperature') return mdiThermometer;
    if (dc === 'humidity') return mdiWaterPercent;
    if (dc === 'power' || dc === 'energy') return mdiFlash;
    return mdiGauge;
  }
  if (domain === 'binary_sensor') return mdiEye;
  return mdiDevices;
}

function colorForEntity(entity: HassEntity): 'primary' | 'danger' | 'success' | 'yellow' | 'default' {
  const domain = entityDomain(entity);
  const on = !['off', 'unavailable', 'unknown'].includes(entity.state.toLowerCase());
  if (domain === 'light' && on) return 'yellow';
  if (domain === 'climate') return 'primary';
  if (domain === 'lock' && on) return 'success';
  if (domain === 'binary_sensor') {
    const dc = entity.attributes.device_class as string | undefined;
    if (dc === 'smoke' || dc === 'gas' || dc === 'safety') return on ? 'danger' : 'default';
  }
  if ((domain === 'switch' || domain === 'fan') && on) return 'primary';
  return 'default';
}

// ── Column grid class ───────────────────────────────────────────────────────

function gridColsClass(columns: 2 | 3 | 4, isEditing: boolean) {
  const gap = isEditing ? 'gap-ha-4' : 'gap-ha-3';
  if (columns === 4) return `grid grid-cols-2 lg:grid-cols-4 ${gap}`;
  if (columns === 3) return `grid grid-cols-2 lg:grid-cols-3 ${gap}`;
  return `grid grid-cols-2 ${gap}`;
}

// ── Card renderer ────────────────────────────────────────────────────────────

function CardContent({ card, entities }: { card: CardConfig; entities: Record<string, HassEntity> }) {
  if (card.type === 'entity' && card.entityId) {
    const entity = entities[card.entityId];
    if (!entity) {
      return (
        <div className="flex items-center gap-ha-2 p-ha-3 rounded-ha-xl bg-surface-low">
          <span className="text-xs text-text-tertiary truncate">{card.entityId}</span>
        </div>
      );
    }
    const size = card.rowSpan === 2 || card.colSpan === 2 ? 'lg' : 'sm';
    return (
      <EntityCard
        icon={iconForEntity(entity)}
        title={friendlyName(entity)}
        state={stateLabel(entity)}
        color={colorForEntity(entity)}
        size={size}
      />
    );
  }
  return <div className="h-16 rounded-ha-xl bg-surface-low" />;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage({ params }: DashboardPageProps) {
  const { slug } = use(params);
  const { items } = useSidebarItems();
  const { isRevealed } = usePullToRevealContext();
  const { setHeader } = useHeader();
  const { contentPaddingClasses, contentTransitionClasses, contentStyle } = useDesktopImmersivePageLayout();
  const { isEditing } = useEditMode();
  const allEntities = useHomeAssistantEntities();
  const { layout, loading, initFromEntities, toggleCardHidden, addCard, reorderCards, updateCard } = useDashboardLayout(slug);

  const dragSourceRef = useRef<{ cardId: string; sectionId: string } | null>(null);
  const [pickerSectionId, setPickerSectionId] = useState<string | null>(null);

  const dashboard = items.find(
    item => item.type === 'dashboard' && item.urlPath === `/dashboard/${slug}`
  );
  const title = dashboard?.title || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  useEffect(() => {
    setHeader({ title, icon: dashboard?.icon ?? undefined });
  }, [setHeader, title, dashboard?.icon]);

  // Auto-generate layout from entities on cold start
  useEffect(() => {
    if (!loading && !layout && Object.keys(allEntities).length > 0) {
      initFromEntities(allEntities);
    }
  }, [loading, layout, allEntities, initFromEntities]);

  // ── Drag-and-drop handlers ────────────────────────────────────────────────

  const handleDragStart = useCallback((cardId: string, sectionId: string) => {
    dragSourceRef.current = { cardId, sectionId };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, _cardId: string, _sectionId: string) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetCardId: string, targetSectionId: string) => {
    e.preventDefault();
    const src = dragSourceRef.current;
    if (!src || !layout) return;
    if (src.sectionId !== targetSectionId || src.cardId === targetCardId) {
      dragSourceRef.current = null;
      return;
    }

    const section = layout.sections.find(s => s.id === targetSectionId);
    if (!section) return;

    const cards = [...section.cards];
    const srcIdx = cards.findIndex(c => c.id === src.cardId);
    const tgtIdx = cards.findIndex(c => c.id === targetCardId);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const [moved] = cards.splice(srcIdx, 1);
    cards.splice(tgtIdx, 0, moved);
    reorderCards(targetSectionId, cards);
    dragSourceRef.current = null;
  }, [layout, reorderCards]);

  // ── Picker section's existing entity IDs ─────────────────────────────────

  const pickerSection = layout?.sections.find(s => s.id === pickerSectionId);
  const existingEntityIds = new Set(
    pickerSection?.cards.map(c => c.entityId).filter(Boolean) as string[] ?? []
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PullToRevealPanel />

      <div
        className={`min-h-0 overflow-hidden ${
          isRevealed ? 'flex-none h-0 opacity-0' : 'flex-1'
        } ${contentPaddingClasses} ${contentTransitionClasses}`}
        style={contentStyle}
      >
        <div className="h-full bg-surface-lower overflow-hidden rounded-ha-3xl">
          <div
            className="h-full overflow-y-auto px-ha-4 pt-ha-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pl-14 lg:pr-ha-5 lg:pt-ha-5 lg:pb-ha-5"
            data-scrollable="dashboard"
          >
            <div className="max-w-[1240px] mx-auto lg:px-ha-8 w-full">
              <ApplicationViewNotice />

              {/* Loading skeleton */}
              {(loading || (!layout && Object.keys(allEntities).length === 0)) && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-ha-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-surface-low rounded-ha-xl p-ha-3 space-y-ha-2 animate-pulse">
                      <div className="flex items-center gap-ha-2">
                        <div className="w-8 h-8 rounded-full bg-surface-lower" />
                        <div className="flex-1 space-y-ha-1">
                          <div className="h-2.5 bg-surface-lower rounded-full w-3/4" />
                          <div className="h-2 bg-surface-lower rounded-full w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Real layout */}
              {layout?.sections.map((section: SectionConfig) => (
                <div key={section.id} className="mb-ha-6">
                  <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-ha-3">
                    {section.title}
                  </h2>

                  <div className={gridColsClass(section.columns, isEditing)}>
                    {section.cards
                      .filter(card => isEditing || !card.hidden)
                      .map((card) =>
                        isEditing ? (
                          <EditableCard
                            key={card.id}
                            cardId={card.id}
                            sectionId={section.id}
                            colSpan={card.colSpan}
                            rowSpan={card.rowSpan}
                            isEditing={isEditing}
                            isHidden={card.hidden}
                            onToggleHidden={() => toggleCardHidden(section.id, card.id)}
                            onResize={(colSpan, rowSpan) => updateCard(section.id, card.id, { colSpan, rowSpan })}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                          >
                            <CardContent card={card} entities={allEntities} />
                          </EditableCard>
                        ) : (
                          <div
                            key={card.id}
                            className={[
                              card.colSpan === 2 ? 'col-span-2' : 'col-span-1',
                              card.rowSpan === 2 ? 'row-span-2' : 'row-span-1',
                            ].join(' ')}
                          >
                            <CardContent card={card} entities={allEntities} />
                          </div>
                        )
                      )}

                    <AnimatePresence>
                      {isEditing && (
                        <AddCardTile
                          key="add-card"
                          onClick={() => setPickerSectionId(section.id)}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Card picker sheet */}
      <AnimatePresence>
        {pickerSectionId && (
          <CardPickerSheet
            key="card-picker"
            sectionId={pickerSectionId}
            existingEntityIds={existingEntityIds}
            onAdd={(card) => addCard(pickerSectionId, card)}
            onClose={() => setPickerSectionId(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
