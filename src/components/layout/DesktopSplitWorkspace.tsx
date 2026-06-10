'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { mdiClose } from '@mdi/js';
import { useHeader } from '@/contexts';
import type { SidebarItem } from '@/hooks';
import { Icon } from '@/components/ui/Icon';
import { HALogo } from '@/components/ui/HALogo';
import { MdiIcon } from '@/components/ui/MdiIcon';

export type SplitSide = 'left' | 'right' | 'top' | 'bottom';

export interface SplitMenuAnchor {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface SplitViewOption {
  route: string;
  title: string;
  subtitle: string;
  icon?: string | null;
  useLogo?: boolean;
}

interface DesktopSplitWorkspaceProps {
  initialPathname: string;
  initialSplit: {
    side: SplitSide;
    route: string;
  };
  routeOptions: SplitViewOption[];
  navigationRequest?: { href: string; nonce: number } | null;
  splitRequest?: { href: string; side?: SplitSide; nonce: number } | null;
  onPrimaryRouteChange?: (route: string) => void;
  onExit: (nextPathname: string) => void;
}

interface PaneMeta {
  title?: string;
  subtitle?: string;
}

interface WorkspaceLeafNode {
  id: string;
  kind: 'leaf';
  route: string;
  meta?: PaneMeta;
}

interface WorkspaceSplitNode {
  id: string;
  kind: 'split';
  direction: 'row' | 'column';
  ratio: number;
  first: WorkspaceNode;
  second: WorkspaceNode;
}

type WorkspaceNode = WorkspaceLeafNode | WorkspaceSplitNode;

type EmbeddedPaneMessage =
  | {
      type: 'ha-next-embedded-route';
      pathname: string;
      title?: string;
      subtitle?: string;
    }
  | {
      type: 'ha-next-open-split-route';
      href: string;
    };

interface SplitMenuState {
  sourcePaneId: string;
  side: SplitSide;
  anchor: SplitMenuAnchor | null;
}

interface PathEntry {
  splitId: string;
  direction: 'row' | 'column';
  branch: 'first' | 'second';
}

const EDGE_DRAG_THRESHOLD = 5;
const INITIAL_COLLAPSED_RATIO = 0.02;
const DEFAULT_SPLIT_RATIO = 0.5;
const MIN_SPLIT_RATIO = 0.18;
const MAX_SPLIT_RATIO = 0.82;
const SPLIT_GAP_SIZE = 12;

const roomPickerOptions: SplitViewOption[] = [
  { route: '/room/living_room', title: 'Living Room', subtitle: 'Room' },
  { route: '/room/kitchen', title: 'Kitchen', subtitle: 'Room' },
  { route: '/room/office', title: 'Office', subtitle: 'Room' },
  { route: '/room/bedroom', title: 'Bedroom', subtitle: 'Room' },
];

const settingsPickerOptions: SplitViewOption[] = [
  { route: '/profile', title: 'Profile', subtitle: 'System' },
  { route: '/settings', title: 'Settings', subtitle: 'System' },
  { route: '/settings/system', title: 'System Settings', subtitle: 'Settings' },
  { route: '/settings/dashboards', title: 'Dashboard Settings', subtitle: 'Settings' },
];

function titleCaseSegment(value: string) {
  const normalized = decodeURIComponent(value).replace(/[-_]+/g, ' ').trim();
  if (!normalized) return 'Home';
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function describePathname(pathname: string): Pick<SplitViewOption, 'title' | 'subtitle'> {
  if (pathname === '/') {
    return { title: 'Home', subtitle: 'Dashboard' };
  }

  if (pathname === '/profile') {
    return { title: 'Profile', subtitle: 'System' };
  }

  if (pathname === '/settings') {
    return { title: 'Settings', subtitle: 'System' };
  }

  if (pathname.startsWith('/settings/')) {
    return { title: titleCaseSegment(pathname.split('/')[2] ?? 'Settings'), subtitle: 'Settings' };
  }

  if (pathname.startsWith('/room/')) {
    return { title: titleCaseSegment(pathname.split('/')[2] ?? 'Room'), subtitle: 'Room' };
  }

  if (pathname.startsWith('/panel/')) {
    return { title: titleCaseSegment(pathname.split('/')[2] ?? 'Panel'), subtitle: 'App' };
  }

  if (pathname.startsWith('/dashboard/')) {
    return { title: titleCaseSegment(pathname.split('/')[2] ?? 'Dashboard'), subtitle: 'Dashboard' };
  }

  return { title: titleCaseSegment(pathname.split('/').filter(Boolean).pop() ?? 'View'), subtitle: 'View' };
}

export function buildSplitViewOptions(initialPathname: string, items: SidebarItem[]): SplitViewOption[] {
  const seen = new Set<string>();
  const options: SplitViewOption[] = [];

  const append = (option: SplitViewOption) => {
    if (!option.route || seen.has(option.route)) return;
    seen.add(option.route);
    options.push(option);
  };

  append({
    route: initialPathname,
    ...describePathname(initialPathname),
  });

  items.forEach((item) => {
    append({
      route: item.urlPath,
      title: item.title,
      subtitle: item.type === 'panel' ? (item.isApp ? 'App' : 'Panel') : 'Dashboard',
      icon: item.icon,
      useLogo: item.urlPath === '/',
    });
  });

  roomPickerOptions.forEach(append);
  settingsPickerOptions.forEach(append);

  return options;
}

function createEmbeddedRoute(pathname: string) {
  return `${pathname}${pathname.includes('?') ? '&' : '?'}embed=1`;
}

function clampRatio(value: number) {
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, value));
}

function getInitialRatioForSide(side: SplitSide) {
  return side === 'left' || side === 'top' ? INITIAL_COLLAPSED_RATIO : 1 - INITIAL_COLLAPSED_RATIO;
}

function countLeaves(node: WorkspaceNode): number {
  if (node.kind === 'leaf') return 1;
  return countLeaves(node.first) + countLeaves(node.second);
}

function findFirstLeaf(node: WorkspaceNode): WorkspaceLeafNode {
  if (node.kind === 'leaf') {
    return node;
  }

  return findFirstLeaf(node.first);
}

function findLeaf(node: WorkspaceNode, targetId: string): WorkspaceLeafNode | null {
  if (node.kind === 'leaf') {
    return node.id === targetId ? node : null;
  }

  return findLeaf(node.first, targetId) ?? findLeaf(node.second, targetId);
}

function updateLeaf(
  node: WorkspaceNode,
  targetId: string,
  updater: (leaf: WorkspaceLeafNode) => WorkspaceLeafNode
): WorkspaceNode {
  if (node.kind === 'leaf') {
    return node.id === targetId ? updater(node) : node;
  }

  return {
    ...node,
    first: updateLeaf(node.first, targetId, updater),
    second: updateLeaf(node.second, targetId, updater),
  };
}

function updateSplitNode(
  node: WorkspaceNode,
  targetId: string,
  updater: (split: WorkspaceSplitNode) => WorkspaceSplitNode
): WorkspaceNode {
  if (node.kind === 'leaf') {
    return node;
  }

  if (node.id === targetId) {
    return updater(node);
  }

  return {
    ...node,
    first: updateSplitNode(node.first, targetId, updater),
    second: updateSplitNode(node.second, targetId, updater),
  };
}

function updateSplitRatio(node: WorkspaceNode, splitId: string, ratio: number): WorkspaceNode {
  return updateSplitNode(node, splitId, (split) => ({
    ...split,
    ratio,
  }));
}

function removeLeaf(
  node: WorkspaceNode,
  targetId: string
): { nextNode: WorkspaceNode | null; removed: boolean } {
  if (node.kind === 'leaf') {
    if (node.id !== targetId) {
      return { nextNode: node, removed: false };
    }

    return { nextNode: null, removed: true };
  }

  const firstResult = removeLeaf(node.first, targetId);
  if (firstResult.removed) {
    if (!firstResult.nextNode) {
      return { nextNode: node.second, removed: true };
    }

    return {
      nextNode: {
        ...node,
        first: firstResult.nextNode,
      },
      removed: true,
    };
  }

  const secondResult = removeLeaf(node.second, targetId);
  if (secondResult.removed) {
    if (!secondResult.nextNode) {
      return { nextNode: node.first, removed: true };
    }

    return {
      nextNode: {
        ...node,
        second: secondResult.nextNode,
      },
      removed: true,
    };
  }

  return { nextNode: node, removed: false };
}

function collectLeafIds(node: WorkspaceNode, ids: string[] = []): string[] {
  if (node.kind === 'leaf') {
    ids.push(node.id);
    return ids;
  }

  collectLeafIds(node.first, ids);
  collectLeafIds(node.second, ids);
  return ids;
}

function createSplitTree(
  currentPathname: string,
  nextPathname: string,
  side: SplitSide,
  createId: () => string
): { root: WorkspaceNode; activePaneId: string; splitId: string } {
  const currentLeaf: WorkspaceLeafNode = {
    id: createId(),
    kind: 'leaf',
    route: currentPathname,
  };
  const newLeaf: WorkspaceLeafNode = {
    id: createId(),
    kind: 'leaf',
    route: nextPathname,
  };
  const splitId = createId();
  const splitNode: WorkspaceSplitNode = {
    id: splitId,
    kind: 'split',
    direction: side === 'left' || side === 'right' ? 'row' : 'column',
    ratio: getInitialRatioForSide(side),
    first: side === 'left' || side === 'top' ? newLeaf : currentLeaf,
    second: side === 'left' || side === 'top' ? currentLeaf : newLeaf,
  };

  return { root: splitNode, activePaneId: newLeaf.id, splitId };
}

function splitLeafWithRoute(
  node: WorkspaceNode,
  targetId: string,
  side: SplitSide,
  route: string,
  createId: () => string
): { nextNode: WorkspaceNode; newLeafId: string | null; splitId: string | null } {
  if (node.kind === 'leaf') {
    if (node.id !== targetId) {
      return { nextNode: node, newLeafId: null, splitId: null };
    }

    const newLeaf: WorkspaceLeafNode = {
      id: createId(),
      kind: 'leaf',
      route,
    };
    const splitId = createId();

    return {
      nextNode: {
        id: splitId,
        kind: 'split',
        direction: side === 'left' || side === 'right' ? 'row' : 'column',
        ratio: getInitialRatioForSide(side),
        first: side === 'left' || side === 'top' ? newLeaf : node,
        second: side === 'left' || side === 'top' ? node : newLeaf,
      },
      newLeafId: newLeaf.id,
      splitId,
    };
  }

  const firstResult = splitLeafWithRoute(node.first, targetId, side, route, createId);
  if (firstResult.newLeafId) {
    return {
      nextNode: {
        ...node,
        first: firstResult.nextNode,
      },
      newLeafId: firstResult.newLeafId,
      splitId: firstResult.splitId,
    };
  }

  const secondResult = splitLeafWithRoute(node.second, targetId, side, route, createId);
  if (secondResult.newLeafId) {
    return {
      nextNode: {
        ...node,
        second: secondResult.nextNode,
      },
      newLeafId: secondResult.newLeafId,
      splitId: secondResult.splitId,
    };
  }

  return { nextNode: node, newLeafId: null, splitId: null };
}

function findPath(node: WorkspaceNode, targetId: string, path: PathEntry[] = []): PathEntry[] | null {
  if (node.kind === 'leaf') {
    return node.id === targetId ? path : null;
  }

  const firstPath = findPath(node.first, targetId, [
    ...path,
    { splitId: node.id, direction: node.direction, branch: 'first' },
  ]);
  if (firstPath) return firstPath;

  return findPath(node.second, targetId, [
    ...path,
    { splitId: node.id, direction: node.direction, branch: 'second' },
  ]);
}

function findResizableSplitForPaneEdge(
  root: WorkspaceNode,
  paneId: string,
  side: SplitSide
): { splitId: string; direction: 'row' | 'column' } | null {
  const path = findPath(root, paneId);
  if (!path) return null;

  if (side === 'right') {
    let validForAncestor = true;
    for (let index = path.length - 1; index >= 0; index -= 1) {
      const entry = path[index];
      if (entry.direction !== 'row') continue;
      if (validForAncestor && entry.branch === 'first') {
        return { splitId: entry.splitId, direction: 'row' };
      }
      validForAncestor = validForAncestor && entry.branch === 'second';
    }
    return null;
  }

  if (side === 'left') {
    let validForAncestor = true;
    for (let index = path.length - 1; index >= 0; index -= 1) {
      const entry = path[index];
      if (entry.direction !== 'row') continue;
      if (validForAncestor && entry.branch === 'second') {
        return { splitId: entry.splitId, direction: 'row' };
      }
      validForAncestor = validForAncestor && entry.branch === 'first';
    }
    return null;
  }

  if (side === 'bottom') {
    let validForAncestor = true;
    for (let index = path.length - 1; index >= 0; index -= 1) {
      const entry = path[index];
      if (entry.direction !== 'column') continue;
      if (validForAncestor && entry.branch === 'first') {
        return { splitId: entry.splitId, direction: 'column' };
      }
      validForAncestor = validForAncestor && entry.branch === 'second';
    }
    return null;
  }

  let validForAncestor = true;
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const entry = path[index];
    if (entry.direction !== 'column') continue;
    if (validForAncestor && entry.branch === 'second') {
      return { splitId: entry.splitId, direction: 'column' };
    }
    validForAncestor = validForAncestor && entry.branch === 'first';
  }

  return null;
}

function createAnchorFromRect(rect: DOMRect): SplitMenuAnchor {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function EdgeSplitHandle({
  side,
  label,
  canResize,
  onOpenMenu,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: {
  side: SplitSide;
  label: string;
  canResize: boolean;
  onOpenMenu: (side: SplitSide, anchor: SplitMenuAnchor) => void;
  onResizeStart: () => void;
  onResizeMove: (point: { x: number; y: number }) => void;
  onResizeEnd: () => void;
}) {
  const zoneClasses = {
    left: 'left-0 top-0 bottom-0 w-10 items-center justify-start pl-1',
    right: 'right-0 top-0 bottom-0 w-10 items-center justify-end pr-1',
    top: 'top-0 left-0 right-0 h-10 items-start justify-center pt-1',
    bottom: 'bottom-0 left-0 right-0 h-10 items-end justify-center pb-1',
  } as const;
  const isVerticalEdge = side === 'left' || side === 'right';

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const anchor = createAnchorFromRect(event.currentTarget.getBoundingClientRect());
    const startX = event.clientX;
    const startY = event.clientY;
    let dragging = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const distance = Math.hypot(deltaX, deltaY);

      if (!dragging && canResize && distance > EDGE_DRAG_THRESHOLD) {
        dragging = true;
        onResizeStart();
      }

      if (dragging) {
        moveEvent.preventDefault();
        onResizeMove({ x: moveEvent.clientX, y: moveEvent.clientY });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      if (dragging) {
        onResizeEnd();
        return;
      }

      onOpenMenu(side, anchor);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [canResize, onOpenMenu, onResizeEnd, onResizeMove, onResizeStart, side]);

  return (
    <div className={`group pointer-events-auto absolute ${zoneClasses[side]} z-20 flex`}>
      <button
        type="button"
        onPointerDown={handlePointerDown}
        title={label}
        className={`flex items-center justify-center text-text-tertiary/70 opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${
          isVerticalEdge ? 'h-12 w-4 cursor-col-resize' : 'h-4 w-12 cursor-row-resize'
        }`}
      >
        <span
          className={`flex ${isVerticalEdge ? 'flex-row gap-[3px]' : 'flex-col gap-[3px]'}`}
          aria-hidden="true"
        >
          <span
            className={`rounded-full bg-current ${
              isVerticalEdge ? 'h-7 w-[2px]' : 'h-[2px] w-7'
            }`}
          />
          <span
            className={`rounded-full bg-current ${
              isVerticalEdge ? 'h-7 w-[2px]' : 'h-[2px] w-7'
            }`}
          />
        </span>
        <span className="sr-only">{label}</span>
      </button>
    </div>
  );
}

function groupViewOptions(options: SplitViewOption[]) {
  const order = ['Dashboard', 'Room', 'App', 'Panel', 'Settings', 'System', 'View'];
  const groups = new Map<string, SplitViewOption[]>();

  options.forEach((option) => {
    const key = option.subtitle || 'View';
    const existing = groups.get(key);
    if (existing) {
      existing.push(option);
      return;
    }
    groups.set(key, [option]);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => {
      const leftIndex = order.indexOf(left);
      const rightIndex = order.indexOf(right);
      const normalizedLeft = leftIndex === -1 ? order.length : leftIndex;
      const normalizedRight = rightIndex === -1 ? order.length : rightIndex;
      return normalizedLeft - normalizedRight || left.localeCompare(right);
    })
    .map(([label, items]) => ({ label, items }));
}

export function DesktopSplitViewMenu({
  side,
  anchor,
  options,
  onSelect,
  onClose,
}: {
  side: SplitSide;
  anchor: SplitMenuAnchor | null;
  options: SplitViewOption[];
  onSelect: (route: string) => void;
  onClose: () => void;
}) {
  const groupedOptions = useMemo(() => groupViewOptions(options), [options]);
  const directionLabel = {
    left: 'Open on the left',
    right: 'Open on the right',
    top: 'Open above',
    bottom: 'Open below',
  } as const;
  const menuWidth = 360;
  const menuHeight = 440;
  const viewportPadding = 16;

  const style = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        top: viewportPadding + 24,
        left: viewportPadding + 24,
      };
    }

    if (!anchor) {
      const defaultPositions = {
        left: { left: viewportPadding, top: window.innerHeight / 2 - 200 },
        right: { left: window.innerWidth - menuWidth - viewportPadding, top: window.innerHeight / 2 - 200 },
        top: { left: window.innerWidth / 2 - menuWidth / 2, top: viewportPadding + 24 },
        bottom: { left: window.innerWidth / 2 - menuWidth / 2, top: window.innerHeight - menuHeight - viewportPadding - 24 },
      } as const;
      const fallback = defaultPositions[side];

      return {
        top: Math.max(viewportPadding, fallback.top),
        left: Math.max(viewportPadding, Math.min(fallback.left, window.innerWidth - menuWidth - viewportPadding)),
      };
    }

    let top = anchor.top;
    let left = anchor.left;

    switch (side) {
      case 'left':
        top = anchor.top - 18;
        left = anchor.right + 12;
        break;
      case 'right':
        top = anchor.top - 18;
        left = anchor.left - menuWidth - 12;
        break;
      case 'top':
        top = anchor.bottom + 12;
        left = anchor.left + anchor.width / 2 - menuWidth / 2;
        break;
      case 'bottom':
        top = anchor.top - menuHeight - 12;
        left = anchor.left + anchor.width / 2 - menuWidth / 2;
        break;
    }

    return {
      top: Math.max(viewportPadding, Math.min(top, window.innerHeight - menuHeight - viewportPadding)),
      left: Math.max(viewportPadding, Math.min(left, window.innerWidth - menuWidth - viewportPadding)),
    };
  }, [anchor, side]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[140]">
      <button
        type="button"
        aria-label="Close split view menu"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-transparent"
      />
      <div
        className="absolute w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-ha-2xl border border-surface-lower bg-surface-default shadow-2xl"
        style={style}
      >
        <div className="flex items-center gap-ha-3 border-b border-surface-lower px-ha-4 py-ha-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">{directionLabel[side]}</p>
            <p className="text-xs text-text-secondary">Choose the view to load in this split.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-lower hover:text-text-primary"
            title="Close menu"
          >
            <Icon path={mdiClose} size={16} />
          </button>
        </div>

        <div className="max-h-[min(56vh,460px)] overflow-y-auto py-ha-2">
          {groupedOptions.map((group) => (
            <div key={group.label} className="mb-ha-1 px-ha-2">
              <div className="px-ha-3 py-ha-1 text-[13px] font-medium uppercase tracking-wider text-text-tertiary">
                {group.label}
              </div>
              {group.items.map((option) => (
                <button
                  key={option.route}
                  type="button"
                  onClick={() => onSelect(option.route)}
                  className="flex w-full items-center gap-ha-3 rounded-ha-xl px-ha-3 py-ha-2 text-left transition-colors hover:bg-surface-lower"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-ha-xl bg-surface-lower">
                    {option.useLogo ? (
                      <HALogo size={20} />
                    ) : option.icon ? (
                      <MdiIcon icon={option.icon} size={20} className="text-ha-blue" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-fill-primary-normal" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-text-primary">{option.title}</div>
                    <div className="truncate text-xs text-text-secondary">{option.route}</div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SplitPaneChrome({
  paneId,
  rootNode,
  paneTitle,
  paneSubtitle,
  isActive,
  onActivate,
  onClose,
  onOpenMenu,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  children,
}: {
  paneId: string;
  rootNode: WorkspaceNode;
  paneTitle: string;
  paneSubtitle: string;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onOpenMenu: (paneId: string, side: SplitSide, anchor: SplitMenuAnchor) => void;
  onResizeStart: (paneId: string, side: SplitSide) => void;
  onResizeMove: (point: { x: number; y: number }) => void;
  onResizeEnd: () => void;
  children: ReactNode;
}) {
  const leftResizable = Boolean(findResizableSplitForPaneEdge(rootNode, paneId, 'left'));
  const rightResizable = Boolean(findResizableSplitForPaneEdge(rootNode, paneId, 'right'));
  const topResizable = Boolean(findResizableSplitForPaneEdge(rootNode, paneId, 'top'));
  const bottomResizable = Boolean(findResizableSplitForPaneEdge(rootNode, paneId, 'bottom'));

  return (
    <section
      className={`group relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[28px] border transition-all duration-200 ${
        isActive ? 'border-white/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]' : 'border-white/8'
      } bg-surface-lower`}
      onMouseEnter={onActivate}
    >
      <div className="flex items-center justify-between gap-ha-3 border-b border-white/6 px-ha-3 py-ha-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary">{paneTitle}</p>
          <p className="truncate text-xs text-text-secondary">{paneSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
          title="Close pane"
        >
          <Icon path={mdiClose} size={18} />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 min-w-0 overflow-hidden" onMouseEnter={onActivate}>
        <EdgeSplitHandle
          side="left"
          label="Split left"
          canResize={leftResizable}
          onOpenMenu={(side, anchor) => onOpenMenu(paneId, side, anchor)}
          onResizeStart={() => onResizeStart(paneId, 'left')}
          onResizeMove={onResizeMove}
          onResizeEnd={onResizeEnd}
        />
        <EdgeSplitHandle
          side="right"
          label="Split right"
          canResize={rightResizable}
          onOpenMenu={(side, anchor) => onOpenMenu(paneId, side, anchor)}
          onResizeStart={() => onResizeStart(paneId, 'right')}
          onResizeMove={onResizeMove}
          onResizeEnd={onResizeEnd}
        />
        <EdgeSplitHandle
          side="top"
          label="Split above"
          canResize={topResizable}
          onOpenMenu={(side, anchor) => onOpenMenu(paneId, side, anchor)}
          onResizeStart={() => onResizeStart(paneId, 'top')}
          onResizeMove={onResizeMove}
          onResizeEnd={onResizeEnd}
        />
        <EdgeSplitHandle
          side="bottom"
          label="Split below"
          canResize={bottomResizable}
          onOpenMenu={(side, anchor) => onOpenMenu(paneId, side, anchor)}
          onResizeStart={() => onResizeStart(paneId, 'bottom')}
          onResizeMove={onResizeMove}
          onResizeEnd={onResizeEnd}
        />
        {children}
      </div>
    </section>
  );
}

function PaneTree({
  node,
  rootNode,
  activePaneId,
  resizingSplitId,
  registerIframe,
  registerSplit,
  onActivatePane,
  onClosePane,
  onOpenSplitMenu,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: {
  node: WorkspaceNode;
  rootNode: WorkspaceNode;
  activePaneId: string;
  resizingSplitId: string | null;
  registerIframe: (paneId: string, element: HTMLIFrameElement | null) => void;
  registerSplit: (splitId: string, element: HTMLDivElement | null) => void;
  onActivatePane: (paneId: string) => void;
  onClosePane: (paneId: string) => void;
  onOpenSplitMenu: (paneId: string, side: SplitSide, anchor: SplitMenuAnchor) => void;
  onResizeStart: (paneId: string, side: SplitSide) => void;
  onResizeMove: (point: { x: number; y: number }) => void;
  onResizeEnd: () => void;
}) {
  if (node.kind === 'split') {
    const firstTrack = `minmax(0, ${Math.max(0.001, node.ratio)}fr)`;
    const secondTrack = `minmax(0, ${Math.max(0.001, 1 - node.ratio)}fr)`;
    const isRow = node.direction === 'row';
    const style = isRow
      ? {
          gridTemplateColumns: `${firstTrack} ${SPLIT_GAP_SIZE}px ${secondTrack}`,
          transition: resizingSplitId === node.id ? 'none' : 'grid-template-columns 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        }
      : {
          gridTemplateRows: `${firstTrack} ${SPLIT_GAP_SIZE}px ${secondTrack}`,
          transition: resizingSplitId === node.id ? 'none' : 'grid-template-rows 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        };

    return (
      <div
        ref={(element) => registerSplit(node.id, element)}
        className="grid h-full min-h-0 min-w-0"
        style={style}
      >
        <div className="min-h-0 min-w-0">
          <PaneTree
            node={node.first}
            rootNode={rootNode}
            activePaneId={activePaneId}
            resizingSplitId={resizingSplitId}
            registerIframe={registerIframe}
            registerSplit={registerSplit}
            onActivatePane={onActivatePane}
            onClosePane={onClosePane}
            onOpenSplitMenu={onOpenSplitMenu}
            onResizeStart={onResizeStart}
            onResizeMove={onResizeMove}
            onResizeEnd={onResizeEnd}
          />
        </div>
        <div className="pointer-events-none min-h-0 min-w-0" />
        <div className="min-h-0 min-w-0">
          <PaneTree
            node={node.second}
            rootNode={rootNode}
            activePaneId={activePaneId}
            resizingSplitId={resizingSplitId}
            registerIframe={registerIframe}
            registerSplit={registerSplit}
            onActivatePane={onActivatePane}
            onClosePane={onClosePane}
            onOpenSplitMenu={onOpenSplitMenu}
            onResizeStart={onResizeStart}
            onResizeMove={onResizeMove}
            onResizeEnd={onResizeEnd}
          />
        </div>
      </div>
    );
  }

  const fallbackMeta = describePathname(node.route);
  const paneTitle = node.meta?.title || fallbackMeta.title;
  const paneSubtitle = node.meta?.subtitle || fallbackMeta.subtitle;

  return (
    <SplitPaneChrome
      paneId={node.id}
      rootNode={rootNode}
      paneTitle={paneTitle}
      paneSubtitle={paneSubtitle}
      isActive={activePaneId === node.id}
      onActivate={() => onActivatePane(node.id)}
      onClose={() => onClosePane(node.id)}
      onOpenMenu={onOpenSplitMenu}
      onResizeStart={onResizeStart}
      onResizeMove={onResizeMove}
      onResizeEnd={onResizeEnd}
    >
      <iframe
        ref={(element) => registerIframe(node.id, element)}
        src={createEmbeddedRoute(node.route)}
        title={paneTitle}
        className="h-full w-full border-0 bg-surface-default"
      />
    </SplitPaneChrome>
  );
}

export function DesktopSplitHotspots({
  onSplit,
  ...props
}: { onSplit: (side: SplitSide, anchor: SplitMenuAnchor) => void } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`pointer-events-none absolute inset-0 hidden lg:block ${props.className ?? ''}`}
      aria-hidden="true"
    >
      <div className="h-full w-full">
        <div className="group pointer-events-auto absolute left-0 top-0 bottom-0 z-20 flex w-10 items-center justify-start pl-1">
          <button
            type="button"
            onClick={(event) => onSplit('left', createAnchorFromRect(event.currentTarget.getBoundingClientRect()))}
            className="flex h-12 w-4 items-center justify-center text-text-tertiary/70 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            title="Split left"
          >
            <span className="flex flex-row gap-[3px]" aria-hidden="true">
              <span className="h-7 w-[2px] rounded-full bg-current" />
              <span className="h-7 w-[2px] rounded-full bg-current" />
            </span>
            <span className="sr-only">Split left</span>
          </button>
        </div>
        <div className="group pointer-events-auto absolute right-0 top-0 bottom-0 z-20 flex w-10 items-center justify-end pr-1">
          <button
            type="button"
            onClick={(event) => onSplit('right', createAnchorFromRect(event.currentTarget.getBoundingClientRect()))}
            className="flex h-12 w-4 items-center justify-center text-text-tertiary/70 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            title="Split right"
          >
            <span className="flex flex-row gap-[3px]" aria-hidden="true">
              <span className="h-7 w-[2px] rounded-full bg-current" />
              <span className="h-7 w-[2px] rounded-full bg-current" />
            </span>
            <span className="sr-only">Split right</span>
          </button>
        </div>
        <div className="group pointer-events-auto absolute top-0 left-0 right-0 z-20 flex h-10 items-start justify-center pt-1">
          <button
            type="button"
            onClick={(event) => onSplit('top', createAnchorFromRect(event.currentTarget.getBoundingClientRect()))}
            className="flex h-4 w-12 items-center justify-center text-text-tertiary/70 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            title="Split above"
          >
            <span className="flex flex-col gap-[3px]" aria-hidden="true">
              <span className="h-[2px] w-7 rounded-full bg-current" />
              <span className="h-[2px] w-7 rounded-full bg-current" />
            </span>
            <span className="sr-only">Split above</span>
          </button>
        </div>
        <div className="group pointer-events-auto absolute bottom-0 left-0 right-0 z-20 flex h-10 items-end justify-center pb-1">
          <button
            type="button"
            onClick={(event) => onSplit('bottom', createAnchorFromRect(event.currentTarget.getBoundingClientRect()))}
            className="flex h-4 w-12 items-center justify-center text-text-tertiary/70 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            title="Split below"
          >
            <span className="flex flex-col gap-[3px]" aria-hidden="true">
              <span className="h-[2px] w-7 rounded-full bg-current" />
              <span className="h-[2px] w-7 rounded-full bg-current" />
            </span>
            <span className="sr-only">Split below</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function DesktopSplitWorkspace({
  initialPathname,
  initialSplit,
  routeOptions,
  navigationRequest,
  splitRequest,
  onPrimaryRouteChange,
  onExit,
}: DesktopSplitWorkspaceProps) {
  const { setHeader } = useHeader();
  const [initialWorkspace] = useState(() => {
    let nextId = 0;
    const createId = () => `split-pane-${nextId++}`;
    const treeState = createSplitTree(initialPathname, initialSplit.route, initialSplit.side, createId);

    return {
      root: treeState.root,
      activePaneId: treeState.activePaneId,
      nextId,
      initialSplitId: treeState.splitId,
    };
  });
  const nextIdRef = useRef(initialWorkspace.nextId);
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const splitRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const resizeStateRef = useRef<{
    splitId: string;
    direction: 'row' | 'column';
    bounds: DOMRect;
  } | null>(null);
  const createId = useCallback(() => `split-pane-${nextIdRef.current++}`, []);
  const [tree, setTree] = useState<WorkspaceNode>(initialWorkspace.root);
  const [activePaneId, setActivePaneId] = useState(initialWorkspace.activePaneId);
  const [splitMenu, setSplitMenu] = useState<SplitMenuState | null>(null);
  const [resizingSplitId, setResizingSplitId] = useState<string | null>(null);

  const paneCount = useMemo(() => countLeaves(tree), [tree]);
  const activeLeaf = useMemo(() => findLeaf(tree, activePaneId), [tree, activePaneId]);
  const activeMeta = activeLeaf ? describePathname(activeLeaf.route) : { title: 'Split View', subtitle: 'Desktop workspace' };
  const activeTitle = activeLeaf?.meta?.title || activeMeta.title;
  const activeSubtitle = activeLeaf?.meta?.subtitle || activeMeta.subtitle;

  const registerIframe = useCallback((paneId: string, element: HTMLIFrameElement | null) => {
    iframeRefs.current[paneId] = element;
  }, []);

  const registerSplit = useCallback((splitId: string, element: HTMLDivElement | null) => {
    splitRefs.current[splitId] = element;
  }, []);

  const animateSplitToDefault = useCallback((splitId: string | null) => {
    if (!splitId) return;

    requestAnimationFrame(() => {
      setTree((currentTree) => updateSplitRatio(currentTree, splitId, DEFAULT_SPLIT_RATIO));
    });
  }, []);

  useEffect(() => {
    animateSplitToDefault(initialWorkspace.initialSplitId);
  }, [animateSplitToDefault, initialWorkspace.initialSplitId]);

  useEffect(() => {
    if (!onPrimaryRouteChange) return;
    onPrimaryRouteChange(findFirstLeaf(tree).route);
  }, [onPrimaryRouteChange, tree]);

  useEffect(() => {
    setHeader({
      title: activeTitle,
      subtitle: paneCount > 1 ? `${paneCount} pane workspace` : activeSubtitle,
      primaryAction: {
        icon: mdiClose,
        onClick: () => onExit(activeLeaf?.route || initialPathname),
      },
    });
  }, [activeLeaf?.route, activeSubtitle, activeTitle, initialPathname, onExit, paneCount, setHeader]);

  useEffect(() => {
    if (!navigationRequest) return;

    setSplitMenu(null);
    setTree((currentTree) =>
      updateLeaf(currentTree, activePaneId, (leaf) => ({
        ...leaf,
        route: navigationRequest.href,
        meta: describePathname(navigationRequest.href),
      }))
    );
  }, [activePaneId, navigationRequest]);

  useEffect(() => {
    if (!splitRequest) return;

    let newLeafId: string | null = null;
    let newSplitId: string | null = null;
    const targetSide = splitRequest.side ?? 'right';

    setTree((currentTree) => {
      const result = splitLeafWithRoute(currentTree, activePaneId, targetSide, splitRequest.href, createId);
      newLeafId = result.newLeafId;
      newSplitId = result.splitId;
      return result.nextNode;
    });

    if (newLeafId) {
      setActivePaneId(newLeafId);
    }

    setSplitMenu(null);
    animateSplitToDefault(newSplitId);
  }, [activePaneId, animateSplitToDefault, createId, splitRequest]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<EmbeddedPaneMessage>) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data) return;

      if (data.type === 'ha-next-open-split-route') {
        const matchedPaneId = Object.entries(iframeRefs.current).find(([, iframe]) => iframe?.contentWindow === event.source)?.[0];
        if (!matchedPaneId) return;

        let newLeafId: string | null = null;
        let newSplitId: string | null = null;

        setTree((currentTree) => {
          const result = splitLeafWithRoute(
            currentTree,
            matchedPaneId,
            'right',
            data.href,
            createId
          );
          newLeafId = result.newLeafId;
          newSplitId = result.splitId;
          return result.nextNode;
        });

        if (newLeafId) {
          setActivePaneId(newLeafId);
        }

        setSplitMenu(null);
        animateSplitToDefault(newSplitId);
        return;
      }

      if (data.type !== 'ha-next-embedded-route') return;

      const matchedPaneId = Object.entries(iframeRefs.current).find(([, iframe]) => iframe?.contentWindow === event.source)?.[0];
      if (!matchedPaneId) return;

      setSplitMenu(null);
      setTree((currentTree) =>
        updateLeaf(currentTree, matchedPaneId, (leaf) => ({
          ...leaf,
          route: data.pathname,
          meta: {
            title: data.title || describePathname(data.pathname).title,
            subtitle: data.subtitle || describePathname(data.pathname).subtitle,
          },
        }))
      );
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [animateSplitToDefault, createId]);

  const handleOpenSplitMenu = useCallback((paneId: string, side: SplitSide, anchor: SplitMenuAnchor) => {
    setActivePaneId(paneId);
    setSplitMenu({
      sourcePaneId: paneId,
      side,
      anchor,
    });
  }, []);

  const handleResizeStart = useCallback((paneId: string, side: SplitSide) => {
    const candidate = findResizableSplitForPaneEdge(tree, paneId, side);
    if (!candidate) return;

    const splitElement = splitRefs.current[candidate.splitId];
    if (!splitElement) return;

    resizeStateRef.current = {
      splitId: candidate.splitId,
      direction: candidate.direction,
      bounds: splitElement.getBoundingClientRect(),
    };
    setResizingSplitId(candidate.splitId);
    setSplitMenu(null);
  }, [tree]);

  const handleResizeMove = useCallback((point: { x: number; y: number }) => {
    const resizeState = resizeStateRef.current;
    if (!resizeState) return;

    const nextRatio = resizeState.direction === 'row'
      ? clampRatio((point.x - resizeState.bounds.left) / resizeState.bounds.width)
      : clampRatio((point.y - resizeState.bounds.top) / resizeState.bounds.height);

    setTree((currentTree) => updateSplitRatio(currentTree, resizeState.splitId, nextRatio));
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizeStateRef.current = null;
    setResizingSplitId(null);
  }, []);

  const handleClosePane = useCallback((paneId: string) => {
    setSplitMenu((currentMenu) => (currentMenu?.sourcePaneId === paneId ? null : currentMenu));
    setTree((currentTree) => {
      const result = removeLeaf(currentTree, paneId);
      const nextNode = result.nextNode;

      if (!nextNode) {
        onExit(activeLeaf?.route || initialPathname);
        return currentTree;
      }

      const remainingLeafIds = collectLeafIds(nextNode);
      setActivePaneId((currentActivePaneId) =>
        currentActivePaneId === paneId ? remainingLeafIds[0] : currentActivePaneId
      );

      if (remainingLeafIds.length === 1) {
        const remainingLeaf = findLeaf(nextNode, remainingLeafIds[0]);
        onExit(remainingLeaf?.route || initialPathname);
      }

      return nextNode;
    });
  }, [activeLeaf?.route, initialPathname, onExit]);

  const handleSelectSplitRoute = useCallback((route: string) => {
    if (!splitMenu) return;

    let newLeafId: string | null = null;
    let newSplitId: string | null = null;

    setTree((currentTree) => {
      const result = splitLeafWithRoute(currentTree, splitMenu.sourcePaneId, splitMenu.side, route, createId);
      newLeafId = result.newLeafId;
      newSplitId = result.splitId;
      return result.nextNode;
    });

    if (newLeafId) {
      setActivePaneId(newLeafId);
    }

    setSplitMenu(null);
    animateSplitToDefault(newSplitId);
  }, [animateSplitToDefault, createId, splitMenu]);

  return (
    <div className="hidden h-full lg:block">
      <div className="h-full px-edge pb-ha-0 pr-edge pt-1">
        <div className="h-full min-h-0">
          <PaneTree
            node={tree}
            rootNode={tree}
            activePaneId={activePaneId}
            resizingSplitId={resizingSplitId}
            registerIframe={registerIframe}
            registerSplit={registerSplit}
            onActivatePane={setActivePaneId}
            onClosePane={handleClosePane}
            onOpenSplitMenu={handleOpenSplitMenu}
            onResizeStart={handleResizeStart}
            onResizeMove={handleResizeMove}
            onResizeEnd={handleResizeEnd}
          />
        </div>
      </div>
      {splitMenu && (
        <DesktopSplitViewMenu
          side={splitMenu.side}
          anchor={splitMenu.anchor}
          options={routeOptions}
          onSelect={handleSelectSplitRoute}
          onClose={() => setSplitMenu(null)}
        />
      )}
    </div>
  );
}
