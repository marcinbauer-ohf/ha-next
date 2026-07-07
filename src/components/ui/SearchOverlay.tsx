'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { SectionLabel } from './SectionLabel';
import { useSearchContext } from '@/contexts/SearchContext';
import { useCloseOnScreensaver, useAssistantContext } from '@/contexts';
import { useCommands, type CommandItem } from '@/hooks/useCommands';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useScrollFades } from '@/hooks/useScrollFades';
import { clsx } from 'clsx';
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
  mdiConsoleLine,
  mdiArrowRightThin,
  mdiBugOutline,
  mdiCreation,
} from '@mdi/js';

// ── Unified palette item ──────────────────────────────────────────────
type PaletteGroup =
  | 'command'
  | 'navigate'
  | 'debug'
  | 'entity'
  | 'room'
  | 'automation'
  | 'ask';

interface PaletteItem {
  id: string;
  group: PaletteGroup;
  icon: string;
  label: string;
  subtitle?: string;
  state?: string;
  active?: boolean;
  keywords?: string[];
  closeOnRun?: boolean;
  run: () => void;
}

// ── Prefix modes (VS Code / Raycast style) ────────────────────────────
const PREFIXES: Record<string, PaletteGroup> = {
  '>': 'command',
  '/': 'navigate',
  '?': 'debug',
};

const GROUP_ORDER: PaletteGroup[] = [
  'command',
  'navigate',
  'entity',
  'room',
  'automation',
  'debug',
  'ask',
];

const groupLabels: Record<PaletteGroup, string> = {
  command: 'Commands',
  navigate: 'Navigate',
  debug: 'Debug & prototype',
  entity: 'Entities',
  room: 'Rooms',
  automation: 'Automations',
  ask: 'Assistant',
};

const groupAccent: Record<PaletteGroup, string> = {
  command: 'text-ha-blue',
  navigate: 'text-ha-blue',
  debug: 'text-orange-500',
  entity: 'text-text-secondary',
  room: 'text-ha-blue',
  automation: 'text-green-500',
  ask: 'text-ha-blue',
};

// Curated default suggestions shown on an empty, un-prefixed query.
const SUGGESTED_IDS = ['cmd.color-mode', 'cmd.theme', 'cmd.font', 'cmd.edit', 'nav.settings', 'nav.energy'];

const RECENTS_KEY = 'ha-palette-recents';
const RECENTS_MAX = 6;

function loadRecents(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as string[]).slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string): string[] {
  const next = [id, ...loadRecents().filter((x) => x !== id)].slice(0, RECENTS_MAX);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

// ── Fuzzy subsequence match. Returns a score (lower = better) or null. ──
function fuzzyScore(text: string, q: string): number | null {
  const t = text.toLowerCase();
  let cursor = 0;
  let first = -1;
  let prev = -1;
  let gaps = 0;
  for (const ch of q) {
    const idx = t.indexOf(ch, cursor);
    if (idx === -1) return null;
    if (first < 0) first = idx;
    if (prev >= 0) gaps += idx - prev - 1;
    prev = idx;
    cursor = idx + 1;
  }
  return first + gaps * 1.5;
}

/** Best score across label (preferred), then keywords/subtitle/state (penalized). */
function matchScore(item: PaletteItem, q: string): number | null {
  const label = fuzzyScore(item.label, q);
  let best = label;
  const consider = (text: string | undefined, penalty: number) => {
    if (!text) return;
    const s = fuzzyScore(text, q);
    if (s !== null && (best === null || s + penalty < best)) best = s + penalty;
  };
  consider(item.subtitle, 40);
  consider(item.state, 40);
  if (item.keywords) for (const k of item.keywords) consider(k, 80);
  return best;
}

// ── Demo search items (entities/rooms/automations) ────────────────────
interface DemoItem {
  group: 'entity' | 'room' | 'automation';
  icon: string;
  name: string;
  subtitle: string;
}

const demoItems: DemoItem[] = [
  { group: 'entity', icon: mdiLightbulb, name: 'Living Room Light', subtitle: 'light.living_room · On' },
  { group: 'entity', icon: mdiLightbulb, name: 'Kitchen Light', subtitle: 'light.kitchen · Off' },
  { group: 'entity', icon: mdiLightbulb, name: 'Bedroom Lamp', subtitle: 'light.bedroom_lamp · Off' },
  { group: 'entity', icon: mdiLightbulb, name: 'Office Desk Light', subtitle: 'light.office_desk · On' },
  { group: 'entity', icon: mdiTelevision, name: 'Living Room TV', subtitle: 'media_player.tv · Off' },
  { group: 'entity', icon: mdiSpeaker, name: 'Kitchen Speaker', subtitle: 'media_player.speaker · Playing' },
  { group: 'entity', icon: mdiLock, name: 'Front Door Lock', subtitle: 'lock.front_door · Locked' },
  { group: 'entity', icon: mdiThermometer, name: 'Living Room Temperature', subtitle: 'sensor.temperature · 22°C' },
  { group: 'entity', icon: mdiWaterPercent, name: 'Bathroom Humidity', subtitle: 'sensor.humidity · 65%' },
  { group: 'room', icon: mdiSofa, name: 'Living Room', subtitle: '2 active · 22°C' },
  { group: 'room', icon: mdiBed, name: 'Bedroom', subtitle: '0 active · 20°C' },
  { group: 'room', icon: mdiSilverwareForkKnife, name: 'Kitchen', subtitle: '1 active · 21°C' },
  { group: 'room', icon: mdiDesk, name: 'Office', subtitle: '3 active · 23°C' },
  { group: 'room', icon: mdiShower, name: 'Bathroom', subtitle: '0 active · 24°C' },
  { group: 'room', icon: mdiToyBrickOutline, name: 'Kids Room', subtitle: '0 active · 21°C' },
  { group: 'room', icon: mdiBalcony, name: 'Balcony', subtitle: '0 active · 18°C' },
  { group: 'room', icon: mdiDoorOpen, name: 'Hallway', subtitle: '0 active · 20°C' },
  { group: 'automation', icon: mdiRobot, name: 'Night Lights Off', subtitle: 'automation · Active' },
  { group: 'automation', icon: mdiRobot, name: 'Morning Routine', subtitle: 'automation · Active' },
  { group: 'automation', icon: mdiRobot, name: 'Away Mode', subtitle: 'automation · Disabled' },
];

export function SearchOverlay() {
  const { searchOpen, closeSearch } = useSearchContext();
  const { openAssistant } = useAssistantContext();
  const router = useRouter();
  const commands = useCommands();

  useCloseOnScreensaver(searchOpen, closeSearch);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listFades = useScrollFades<HTMLDivElement>();

  useFocusTrap(searchOpen, containerRef);

  // Detect a leading prefix to scope the search.
  const prefixChar = query.charAt(0);
  const mode: PaletteGroup | null = PREFIXES[prefixChar] ?? null;
  const term = (mode ? query.slice(1) : query).trim();

  // Build the full palette: commands + demo search items, with run handlers.
  const allItems = useMemo<PaletteItem[]>(() => {
    const fromCommands: PaletteItem[] = commands.map((c: CommandItem) => ({
      id: c.id,
      group: c.group,
      icon: c.icon,
      label: c.label,
      state: c.state,
      active: c.active,
      keywords: c.keywords,
      closeOnRun: c.closeOnRun,
      run: c.run,
    }));

    const fromDemo: PaletteItem[] = demoItems.map((d) => {
      const id = `${d.group}.${d.name}`;
      let run: () => void;
      if (d.group === 'room') {
        const slug = d.name.toLowerCase().replace(/\s+/g, '_');
        run = () => router.push(`/room/${slug}`);
      } else if (d.group === 'automation') {
        run = () => router.push('/settings/automations');
      } else {
        run = () => {}; // entities have no detail route yet — just close
      }
      return {
        id,
        group: d.group,
        icon: d.icon,
        label: d.name,
        subtitle: d.subtitle,
        keywords: [d.subtitle],
        closeOnRun: true,
        run,
      };
    });

    return [...fromCommands, ...fromDemo];
  }, [commands, router]);

  const byId = useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems]);

  // Compute the visible result list for the current query/mode.
  const { sections, flatItems } = useMemo(() => {
    const pool = mode ? allItems.filter((i) => i.group === mode) : allItems;

    let results: PaletteItem[];
    if (term) {
      results = pool
        .map((item) => ({ item, score: matchScore(item, term) }))
        .filter((r) => r.score !== null)
        .sort((a, b) => (a.score! - b.score!))
        .map((r) => r.item);
    } else if (mode) {
      results = pool;
    } else {
      // Empty, un-prefixed: curated suggestions only (recents render separately).
      results = SUGGESTED_IDS.map((id) => byId.get(id)).filter(Boolean) as PaletteItem[];
    }

    // Group while preserving GROUP_ORDER; within a group keep result order.
    const buckets = new Map<PaletteGroup, PaletteItem[]>();
    for (const item of results) {
      const arr = buckets.get(item.group) ?? [];
      arr.push(item);
      buckets.set(item.group, arr);
    }
    const ordered: { group: PaletteGroup; items: PaletteItem[] }[] = [];
    for (const g of GROUP_ORDER) {
      const items = buckets.get(g);
      if (items?.length) ordered.push({ group: g, items });
    }

    // Merged assistant entry — always available as the last row when the
    // palette isn't prefix-scoped: with a query it hands the question over
    // to the assistant, empty it's the plain "ask anything" entry point.
    if (!mode) {
      ordered.push({
        group: 'ask',
        items: [{
          id: 'ask.home',
          group: 'ask',
          icon: mdiCreation,
          label: term ? `Ask Home — “${term}”` : 'Ask Home anything…',
          subtitle: term ? 'Hand this question to your assistant' : 'Questions and commands, by voice or text',
          closeOnRun: true,
          run: () => openAssistant(term || undefined),
        }],
      });
    }

    return { sections: ordered, flatItems: ordered.flatMap((s) => s.items) };
  }, [allItems, byId, mode, term, openAssistant]);

  // Recents resolved to live items (only when empty + un-prefixed).
  const showRecents = !term && !mode;
  const recentItems = useMemo(
    () => (showRecents ? (recents.map((id) => byId.get(id)).filter(Boolean) as PaletteItem[]) : []),
    [showRecents, recents, byId]
  );

  // Mount/unmount with animation; reset query + load recents on open.
  useEffect(() => {
    if (searchOpen) {
      setMounted(true);
      setQuery('');
      setSelectedIndex(0);
      setRecents(loadRecents());
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

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keep selection in range when the live list shrinks (e.g. after a toggle).
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, flatItems.length - 1)));
  }, [flatItems.length]);

  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    if (selected) selected.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const activate = useCallback(
    (item: PaletteItem) => {
      setRecents(pushRecent(item.id));
      item.run();
      // Live toggles keep the palette open so several can be flipped quickly.
      if (item.closeOnRun) closeSearch();
    },
    [closeSearch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter': {
          e.preventDefault();
          const item = flatItems[selectedIndex];
          if (item) activate(item);
          break;
        }
        case 'Escape':
          e.preventDefault();
          closeSearch();
          break;
      }
    },
    [flatItems, selectedIndex, activate, closeSearch]
  );

  if (!mounted) return null;

  let flatIndex = 0;
  const modeLabel = mode ? groupLabels[mode] : null;
  // The ask fallback row doesn't count as a search result.
  const noResults = (term || mode) && flatItems.filter((i) => i.group !== 'ask').length === 0;

  const renderRow = (item: PaletteItem) => {
    const currentIndex = flatIndex++;
    const isSelected = currentIndex === selectedIndex;
    return (
      <button
        key={item.id}
        data-selected={isSelected}
        onClick={() => activate(item)}
        onMouseEnter={() => setSelectedIndex(currentIndex)}
        className={`w-full flex items-center gap-ha-3 px-ha-3 py-ha-3 rounded-ha-xl transition-colors text-left ${
          isSelected ? 'bg-fill-primary-quiet' : 'hover:bg-surface-mid/50'
        }`}
      >
        <div
          className={`w-9 h-9 rounded-ha-xl bg-surface-lower flex items-center justify-center flex-shrink-0 ${
            isSelected ? 'bg-fill-primary-normal text-ha-blue' : groupAccent[item.group]
          }`}
        >
          <Icon path={item.icon} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] font-semibold leading-tight truncate ${isSelected ? 'text-ha-blue' : 'text-text-primary'}`}>
            {item.label}
          </div>
          {item.subtitle && <div className="text-xs text-text-secondary truncate mt-0.5">{item.subtitle}</div>}
        </div>
        {/* Live state pill for toggles/values */}
        {item.state && (
          <span
            className={`flex-shrink-0 inline-flex items-center text-xs font-semibold tracking-wide px-ha-3 py-1.5 rounded-full ${
              item.active
                ? 'bg-ha-blue/15 text-ha-blue'
                : 'bg-surface-lower text-text-secondary'
            }`}
          >
            {item.state}
          </span>
        )}
        {isSelected && (
          <kbd className="hidden lg:flex items-center text-[13px] text-text-tertiary bg-surface-lower px-ha-1.5 py-0.5 rounded-ha-md">
            <Icon path={mdiKeyboardReturn} size={12} />
          </kbd>
        )}
      </button>
    );
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Search and commands"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] lg:pt-[16vh]"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={closeSearch}
      />

      {/* Palette */}
      <div
        className={`relative w-[calc(100%-2rem)] max-w-[640px] bg-surface-default rounded-ha-2xl shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] overflow-hidden border border-surface-lower transition-[opacity,transform] duration-200 ease-out ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-ha-3 px-ha-4 h-14 border-b border-surface-lower">
          <Icon
            path={mode === 'command' ? mdiConsoleLine : mode === 'debug' ? mdiBugOutline : mode === 'navigate' ? mdiArrowRightThin : mdiMagnify}
            size={22}
            className={`flex-shrink-0 ${mode ? 'text-ha-blue' : 'text-text-secondary'}`}
          />
          {modeLabel && (
            <span className="flex-shrink-0 text-xs font-semibold text-ha-blue bg-ha-blue/15 px-ha-3 py-1 rounded-full">
              {modeLabel}
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Search or ask anything, > commands, / navigate"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-base text-text-primary placeholder-text-tertiary outline-none"
          />
          <kbd className="hidden lg:flex items-center text-[13px] text-text-tertiary bg-surface-lower px-ha-1.5 py-0.5 rounded-ha-md font-medium">
            ESC
          </kbd>
        </div>

        {/* Results — wrapped so the standard scroll fades can overlay the list */}
        <div className="relative">
          <div className={clsx('absolute top-0 left-0 right-0 h-8 pointer-events-none bg-gradient-to-b from-surface-default via-surface-default/60 to-transparent z-10 transition-opacity duration-300', listFades.showTop ? 'opacity-100' : 'opacity-0')} />
          <div className={clsx('absolute bottom-0 left-0 right-0 h-8 pointer-events-none bg-gradient-to-t from-surface-default via-surface-default/60 to-transparent z-10 transition-opacity duration-300', listFades.showBottom ? 'opacity-100' : 'opacity-0')} />
        <div
          ref={(el) => {
            listRef.current = el;
            listFades.attach(el);
          }}
          className="max-h-[min(60vh,480px)] overflow-y-auto py-ha-2"
        >
          {/* Recents (empty + un-prefixed) */}
          {showRecents && recentItems.length > 0 && (
            <div className="px-ha-2 mb-ha-1">
              <SectionLabel className="px-ha-3 py-ha-1">Recent</SectionLabel>
              {recentItems.map((item) => (
                <button
                  key={`recent-${item.id}`}
                  onClick={() => activate(item)}
                  className="w-full flex items-center gap-ha-3 px-ha-3 py-ha-3 rounded-ha-xl hover:bg-surface-mid/50 transition-colors text-left"
                >
                  <Icon path={mdiHistory} size={18} className="text-text-tertiary flex-shrink-0" />
                  <span className="flex-1 text-[13px] font-medium text-text-secondary truncate">{item.label}</span>
                  {item.state && (
                    <span className="text-[11px] text-text-tertiary uppercase tracking-wide">{item.state}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* No results — shown above the ask fallback row so "ask instead" reads as the next step */}
          {noResults && (
            <div className="text-center py-ha-8 px-ha-4">
              <Icon path={mdiMagnify} size={36} className="text-text-tertiary mx-auto mb-ha-2" />
              <p className="text-sm text-text-secondary">No results{term ? ` for “${term}”` : ''}</p>
              <p className="text-xs text-text-tertiary mt-ha-1">Try a different term or prefix — or ask instead</p>
            </div>
          )}

          {/* Grouped results */}
          {sections.map((section) => (
            <div key={section.group} className="px-ha-2 mb-ha-1">
              <SectionLabel className="px-ha-3 py-ha-1">
                {showRecents && section.group !== 'ask' ? 'Suggestions' : groupLabels[section.group]}
              </SectionLabel>
              {section.items.map(renderRow)}
            </div>
          ))}
        </div>
        </div>

        {/* Footer hints */}
        <div className="hidden lg:flex items-center gap-ha-4 px-ha-4 py-ha-2 border-t border-surface-lower text-[13px] text-text-tertiary">
          <span className="flex items-center gap-ha-1">
            <Icon path={mdiArrowUpDown} size={12} />
            Navigate
          </span>
          <span className="flex items-center gap-ha-1">
            <Icon path={mdiKeyboardReturn} size={12} />
            Run
          </span>
          <span className="ml-auto flex items-center gap-ha-3">
            <span><kbd className="bg-surface-lower px-1 py-0.5 rounded text-[12px] font-semibold">&gt;</kbd> cmd</span>
            <span><kbd className="bg-surface-lower px-1 py-0.5 rounded text-[12px] font-semibold">/</kbd> nav</span>
            <span><kbd className="bg-surface-lower px-1 py-0.5 rounded text-[12px] font-semibold">?</kbd> debug</span>
          </span>
        </div>
      </div>
    </div>
  );
}
