'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { SearchField } from '@/components/ui/SearchField';
import { useHomeAssistantEntities } from '@/hooks/useHomeAssistant';
import {
  mdiClose,
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
import type { CardConfig } from '@/hooks/useDashboardLayout';

function entityDomain(entityId: string) {
  return entityId.split('.')[0];
}

function friendlyName(entity: HassEntity): string {
  return (entity.attributes.friendly_name as string | undefined) ?? entity.entity_id;
}

function stateLabel(entity: HassEntity): string {
  const s = entity.state;
  const unit = entity.attributes.unit_of_measurement as string | undefined;
  return unit ? `${s} ${unit}` : s.charAt(0).toUpperCase() + s.slice(1);
}

function iconForEntity(entity: HassEntity): string {
  const domain = entityDomain(entity.entity_id);
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

const TAB_DOMAINS: Record<string, string[]> = {
  Lights: ['light'],
  Climate: ['climate'],
  Media: ['media_player'],
  Switches: ['switch', 'input_boolean'],
  Sensors: ['sensor', 'binary_sensor'],
  Other: ['fan', 'lock', 'cover', 'vacuum', 'button', 'number', 'select', 'input_number', 'input_select'],
};

const TABS = Object.keys(TAB_DOMAINS);

interface CardPickerSheetProps {
  sectionId: string;
  existingEntityIds: Set<string>;
  onAdd: (card: CardConfig) => void;
  onClose: () => void;
}

export function CardPickerSheet({ sectionId, existingEntityIds, onAdd, onClose }: CardPickerSheetProps) {
  const allEntities = useHomeAssistantEntities();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 300);
  }, []);

  const filtered = Object.values(allEntities).filter((entity) => {
    const domain = entityDomain(entity.entity_id);
    const inTab = TAB_DOMAINS[activeTab]?.includes(domain);
    if (!inTab) return false;
    if (existingEntityIds.has(entity.entity_id)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        entity.entity_id.toLowerCase().includes(q) ||
        friendlyName(entity).toLowerCase().includes(q)
      );
    }
    return true;
  });

  function handleAdd(entity: HassEntity) {
    const card: CardConfig = {
      id: `card-${entity.entity_id}-${Date.now()}`,
      type: 'entity',
      entityId: entity.entity_id,
      colSpan: 1,
      rowSpan: 1,
    };
    onAdd(card);
    onClose();
  }

  return (
    <motion.div
      key="picker-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full lg:w-[480px] lg:rounded-ha-3xl bg-surface-default rounded-t-ha-3xl shadow-2xl flex flex-col max-h-[85vh] lg:max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-ha-3 pb-ha-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-surface-mid" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-ha-4 py-ha-3">
          <h2 className="text-base font-semibold text-text-primary">Add Card</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full hover:bg-surface-low text-text-secondary transition-colors"
          >
            <Icon path={mdiClose} size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-ha-4 pb-ha-3">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search entities…"
            inputRef={searchRef}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-ha-2 px-ha-4 overflow-x-auto scrollbar-hide pb-ha-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-ha-3 py-ha-1 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-ha-blue text-white'
                  : 'bg-surface-low text-text-secondary hover:bg-surface-mid'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Entity list */}
        <div className="flex-1 overflow-y-auto px-ha-4 pb-ha-4 pt-ha-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-ha-6">
              {search ? 'No matching entities' : 'All entities already added'}
            </p>
          ) : (
            <div className="space-y-ha-2">
              {filtered.map((entity) => (
                <button
                  key={entity.entity_id}
                  onClick={() => handleAdd(entity)}
                  className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-surface-default flex items-center justify-center flex-shrink-0">
                    <Icon path={iconForEntity(entity)} size={20} className="text-text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{friendlyName(entity)}</p>
                    <p className="text-xs text-text-tertiary truncate">{stateLabel(entity)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
