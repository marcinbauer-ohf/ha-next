'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from './Icon';
import { useSearchContext } from '@/contexts/SearchContext';
import {
  mdiMagnify,
  mdiLightbulb,
  mdiTelevision,
  mdiSpeaker,
  mdiLock,
  mdiSofa,
  mdiBed,
  mdiSilverwareForkKnife,
  mdiDesk,
  mdiShower,
  mdiDoorOpen,
  mdiToyBrickOutline,
  mdiBalcony,
  mdiThermometer,
  mdiWaterPercent,
  mdiHistory,
  mdiRobot,
  mdiKeyboardReturn,
  mdiArrowUpDown,
} from '@mdi/js';

interface SearchItem {
  type: 'entity' | 'room' | 'automation';
  icon: string;
  name: string;
  subtitle: string;
}

const allItems: SearchItem[] = [
  { type: 'entity', icon: mdiLightbulb, name: 'Living Room Light', subtitle: 'light.living_room \u00b7 On' },
  { type: 'entity', icon: mdiLightbulb, name: 'Kitchen Light', subtitle: 'light.kitchen \u00b7 Off' },
  { type: 'entity', icon: mdiLightbulb, name: 'Bedroom Lamp', subtitle: 'light.bedroom_lamp \u00b7 Off' },
  { type: 'entity', icon: mdiLightbulb, name: 'Office Desk Light', subtitle: 'light.office_desk \u00b7 On' },
  { type: 'entity', icon: mdiTelevision, name: 'Living Room TV', subtitle: 'media_player.tv \u00b7 Off' },
  { type: 'entity', icon: mdiSpeaker, name: 'Kitchen Speaker', subtitle: 'media_player.speaker \u00b7 Playing' },
  { type: 'entity', icon: mdiLock, name: 'Front Door Lock', subtitle: 'lock.front_door \u00b7 Locked' },
  { type: 'entity', icon: mdiThermometer, name: 'Living Room Temperature', subtitle: 'sensor.temperature \u00b7 22\u00b0C' },
  { type: 'entity', icon: mdiWaterPercent, name: 'Bathroom Humidity', subtitle: 'sensor.humidity \u00b7 65%' },
  { type: 'room', icon: mdiSofa, name: 'Living Room', subtitle: '2 active \u00b7 22\u00b0C' },
  { type: 'room', icon: mdiBed, name: 'Bedroom', subtitle: '0 active \u00b7 20\u00b0C' },
  { type: 'room', icon: mdiSilverwareForkKnife, name: 'Kitchen', subtitle: '1 active \u00b7 21\u00b0C' },
  { type: 'room', icon: mdiDesk, name: 'Office', subtitle: '3 active \u00b7 23\u00b0C' },
  { type: 'room', icon: mdiShower, name: 'Bathroom', subtitle: '0 active \u00b7 24\u00b0C' },
  { type: 'room', icon: mdiToyBrickOutline, name: 'Kids Room', subtitle: '0 active \u00b7 21\u00b0C' },
  { type: 'room', icon: mdiBalcony, name: 'Balcony', subtitle: '0 active \u00b7 18\u00b0C' },
  { type: 'room', icon: mdiDoorOpen, name: 'Hallway', subtitle: '0 active \u00b7 20\u00b0C' },
  { type: 'automation', icon: mdiRobot, name: 'Night Lights Off', subtitle: 'automation \u00b7 Active' },
  { type: 'automation', icon: mdiRobot, name: 'Morning Routine', subtitle: 'automation \u00b7 Active' },
  { type: 'automation', icon: mdiRobot, name: 'Away Mode', subtitle: 'automation \u00b7 Disabled' },
];

const recentSearches = ['Living Room', 'Temperature', 'Front Door'];

const typeLabels: Record<string, string> = {
  entity: 'Entities',
  room: 'Rooms',
  automation: 'Automations',
};

const typeColors: Record<string, string> = {
  entity: 'text-text-secondary',
  room: 'text-ha-blue',
  automation: 'text-green-500',
};

export function SearchOverlay() {
  const { searchOpen, closeSearch } = useSearchContext();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? allItems.filter(item =>
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  // Group results by type, maintaining order
  const grouped: { type: string; items: SearchItem[] }[] = [];
  const seen = new Set<string>();
  for (const item of filtered) {
    if (!seen.has(item.type)) {
      seen.add(item.type);
      grouped.push({ type: item.type, items: filtered.filter(i => i.type === item.type) });
    }
  }

  // Flat list for keyboard navigation
  const flatItems = grouped.flatMap(g => g.items);

  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Mount/unmount with animation
  useEffect(() => {
    if (searchOpen) {
      setMounted(true);
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
          inputRef.current?.focus();
        });
      });
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(timer);
    }
  }, [searchOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        // Would navigate/act on selected item
        closeSearch();
        break;
      case 'Escape':
        e.preventDefault();
        closeSearch();
        break;
    }
  }, [flatItems.length, closeSearch]);

  if (!mounted) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] lg:pt-[16vh]">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeSearch}
      />

      {/* Search container */}
      <div
        className={`relative w-[calc(100%-2rem)] max-w-[640px] bg-surface-default rounded-ha-2xl shadow-2xl overflow-hidden border border-surface-lower transition-[opacity,transform] duration-200 ease-out ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-ha-3 px-ha-4 h-14 border-b border-surface-lower">
          <Icon path={mdiMagnify} size={22} className="text-text-secondary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search entities, rooms, automations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-base text-text-primary placeholder-text-tertiary outline-none"
          />
          <kbd className="hidden lg:flex items-center text-[11px] text-text-tertiary bg-surface-lower px-ha-1.5 py-0.5 rounded-ha-md font-medium">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[min(60vh,480px)] overflow-y-auto py-ha-2">
          {/* Recent searches when no query */}
          {!query && (
            <div className="px-ha-2 mb-ha-1">
              <div className="text-[11px] text-text-tertiary uppercase tracking-wider font-medium px-ha-3 py-ha-1">Recent</div>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="w-full flex items-center gap-ha-3 px-ha-3 py-ha-2 rounded-ha-xl hover:bg-surface-lower transition-colors text-left"
                >
                  <Icon path={mdiHistory} size={18} className="text-text-tertiary flex-shrink-0" />
                  <span className="text-sm text-text-secondary">{term}</span>
                </button>
              ))}
            </div>
          )}

          {/* Grouped results */}
          {grouped.map((group) => (
            <div key={group.type} className="px-ha-2 mb-ha-1">
              <div className="text-[11px] text-text-tertiary uppercase tracking-wider font-medium px-ha-3 py-ha-1">
                {typeLabels[group.type]}
              </div>
              {group.items.map((item) => {
                const currentIndex = flatIndex++;
                const isSelected = currentIndex === selectedIndex;
                return (
                  <button
                    key={`${item.type}-${item.name}`}
                    data-selected={isSelected}
                    onClick={closeSearch}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                    className={`w-full flex items-center gap-ha-3 px-ha-3 py-ha-2 rounded-ha-xl transition-colors text-left ${
                      isSelected ? 'bg-fill-primary-quiet' : 'hover:bg-surface-lower'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-ha-xl bg-surface-lower flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-fill-primary-normal text-ha-blue' : typeColors[item.type]
                    }`}>
                      <Icon path={item.icon} size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate ${isSelected ? 'text-ha-blue font-medium' : 'text-text-primary'}`}>
                        {item.name}
                      </div>
                      <div className="text-xs text-text-secondary truncate">{item.subtitle}</div>
                    </div>
                    {isSelected && (
                      <kbd className="hidden lg:flex items-center text-[11px] text-text-tertiary bg-surface-lower px-ha-1.5 py-0.5 rounded-ha-md">
                        <Icon path={mdiKeyboardReturn} size={12} />
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* No results */}
          {query && filtered.length === 0 && (
            <div className="text-center py-ha-8 px-ha-4">
              <Icon path={mdiMagnify} size={36} className="text-text-tertiary mx-auto mb-ha-2" />
              <p className="text-sm text-text-secondary">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-text-tertiary mt-ha-1">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="hidden lg:flex items-center gap-ha-4 px-ha-4 py-ha-2 border-t border-surface-lower text-[11px] text-text-tertiary">
          <span className="flex items-center gap-ha-1">
            <Icon path={mdiArrowUpDown} size={12} />
            Navigate
          </span>
          <span className="flex items-center gap-ha-1">
            <Icon path={mdiKeyboardReturn} size={12} />
            Open
          </span>
          <span className="flex items-center gap-ha-1">
            <kbd className="bg-surface-lower px-1 py-0.5 rounded text-[10px] font-medium">ESC</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
