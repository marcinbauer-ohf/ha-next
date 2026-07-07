'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { RollingText } from '../ui/RollingText';
import { AddMenu } from '../ui/AddMenu';
import { Tooltip } from '../ui/Tooltip';
import { shortcutHint, useIsMacPlatform } from '@/lib/keyboardShortcuts';
import { useHeader, usePullToRevealContext, ENABLE_PULL_TO_REVEAL, useEditMode, useSearchContext } from '@/contexts';
import { useTheme, useImmersiveMode, useHomeAssistant } from '@/hooks';
import {
  mdiPencil,
  mdiCheck,
  mdiPlus,
  mdiMenu,
  mdiClose,
  mdiArrowLeft,
  mdiMagnify,
} from '@mdi/js';

export function TopBar() {
  const { theme } = useTheme();
  const { title, subtitle, breadcrumbs, primaryAction, onBack, hideBack, contentGutter, sectionCrumb, sectionCrumbReverse } = useHeader();
  const { isRevealed, toggle } = usePullToRevealContext();
  const { isEditing, toggleEditMode } = useEditMode();
  const { openSearch } = useSearchContext();
  const { immersiveMode } = useImmersiveMode();
  const { isAdmin } = useHomeAssistant();
  const router = useRouter();
  const pathname = usePathname();
  const isMac = useIsMacPlatform();
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const desktopAddButtonRef = useRef<HTMLButtonElement | null>(null);

  // Energy has its own read-only view; all other dashboard paths support edit mode
  const isDashboardPage = pathname === '/' ||
    (pathname.startsWith('/dashboard/') && pathname !== '/dashboard/energy');
  const pencilIcon = isEditing ? mdiCheck : mdiPencil;
  const pencilLabel = isEditing ? 'Done' : 'Edit';

  // Keep one persistent RollingText (and its flex-col shell) across the
  // subtitle/no-subtitle change so navigating settings↔home rolls the title
  // instead of remounting it. The size flexes with whether a subtitle shows.
  // Reversed breadcrumb: the dashboard's scrolled-away section header reappears
  // as a small line UNDER the title (title on top, section crumb at bottom).
  const hasCrumb = !!sectionCrumb?.trim();
  // Keep the last non-empty crumb text so it stays readable while the line
  // collapses (rather than blanking the moment the crumb clears).
  const [displayCrumb, setDisplayCrumb] = useState(sectionCrumb ?? '');
  useEffect(() => {
    if (sectionCrumb?.trim()) setDisplayCrumb(sectionCrumb);
  }, [sectionCrumb]);

  // Reversed-breadcrumb line under the title. Grows/collapses smoothly (grid
  // rows + opacity) instead of popping in, and rolls in the scroll direction.
  const sectionCrumbLine = (
    <div
      className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
      style={{ gridTemplateRows: hasCrumb ? '1fr' : '0fr', opacity: hasCrumb ? 1 : 0 }}
      aria-hidden={!hasCrumb}
    >
      <div className="overflow-hidden min-h-0">
        <RollingText
          text={displayCrumb}
          reverse={sectionCrumbReverse}
          className="text-xs font-medium text-text-secondary capitalize"
        />
      </div>
    </div>
  );

  // The header stays at two lines max: when the section crumb rolls in under
  // the title, the root eyebrow ("Home") above it collapses away with the same
  // grid-rows animation, and comes back once the crumb clears.
  const collapseEyebrow = (node: ReactNode) => (
    <div
      className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
      style={{ gridTemplateRows: hasCrumb ? '0fr' : '1fr', opacity: hasCrumb ? 0 : 1 }}
      aria-hidden={hasCrumb}
    >
      <div className="overflow-hidden min-h-0">{node}</div>
    </div>
  );

  const hasTrail = !!breadcrumbs && breadcrumbs.length > 0;

  // Pick the title roll axis from how the header eyebrow (breadcrumb trail or
  // subtitle like room/type pages' "Home") is changing:
  // entering a detail screen (eyebrow appears) → horizontal in from the right;
  // leaving it via back (eyebrow disappears) → horizontal in from the left;
  // detail→detail keeps the forward slide; section↔section children stay
  // vertical (the dashboard-value roll). prevHasEyebrow is read during render
  // and updated after paint, so it reflects the *previous* title at change time.
  const hasEyebrow = hasTrail || !!subtitle?.trim();
  const prevHasEyebrow = useRef(hasEyebrow);
  let titleDirection: 'vertical' | 'horizontal' = 'vertical';
  let titleReverse = false;
  if (hasEyebrow) {
    titleDirection = 'horizontal'; // into / between detail screens
  } else if (prevHasEyebrow.current) {
    titleDirection = 'horizontal'; // backing out of a detail screen
    titleReverse = true;
  }
  useEffect(() => {
    prevHasEyebrow.current = hasEyebrow;
  }, [hasEyebrow]);

  const titleContent = (
    <div className="flex flex-col leading-none gap-0.5 text-left">
      {subtitle?.trim() && collapseEyebrow(<span className="text-xs text-text-secondary capitalize">{subtitle}</span>)}
      <RollingText
        text={title}
        direction={titleDirection}
        reverse={titleReverse}
        className={`${subtitle ? 'text-base' : 'text-lg'} font-semibold text-text-primary capitalize`}
      />
      {sectionCrumbLine}
    </div>
  );

  const desktopEyebrow = hasTrail ? (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-text-secondary">
      {breadcrumbs!.map((crumb, i) => (
        <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="text-text-tertiary">›</span>}
          {crumb.onClick ? (
            <button
              type="button"
              onClick={crumb.onClick}
              className="capitalize rounded-sm transition-colors hover:text-text-primary hover:underline underline-offset-2"
            >
              {crumb.label}
            </button>
          ) : (
            <span className="capitalize">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  ) : subtitle?.trim() ? (
    <span className="text-xs text-text-secondary capitalize">{subtitle}</span>
  ) : null;

  // Single persistent flex-col + RollingText for every header shape, so the
  // title rolls (rather than hard-remounts) when moving between a standalone
  // page like Home and a subtitled/breadcrumbed one like Settings. Standalone
  // gets the larger 2xl size; eyebrow/breadcrumb shapes use xl.
  const desktopStandalone = !hasTrail && !subtitle;
  const desktopTitleSize = desktopStandalone ? 'text-2xl' : 'text-xl';
  const desktopTitleContent = (
    <div className="flex flex-col leading-none gap-0.5 text-left">
      {desktopEyebrow && collapseEyebrow(desktopEyebrow)}
      <h1 className={`${desktopTitleSize} leading-none font-semibold text-text-primary capitalize`}>
        <RollingText
          text={title}
          direction={titleDirection}
          reverse={titleReverse}
          className={`${desktopTitleSize} font-semibold capitalize`}
        />
      </h1>
      {sectionCrumbLine}
    </div>
  );

  // Detail pages (room/type/category) reserve a left "back gutter" in their
  // content surface. When that's active the top bar mirrors it: the desktop back
  // arrow sits centered in the same-width gutter (stacked over the surface's
  // faint back arrow, anchored to the header's far edge so it lines up at every
  // width), and the title indents by the gutter so it stays on the content's
  // left edge. Off-gutter back pages (e.g. settings detail) keep the inline arrow.
  // A back affordance shows whenever the header carries an eyebrow (a subtitle
  // like the sub-dashboards' "Home", or a breadcrumb trail) and isn't
  // explicitly suppressed. Same rule for mobile and desktop so dashboards and
  // settings behave identically; falls back to router.back() when the page
  // doesn't wire an explicit onBack.
  const showBack = !!(subtitle || hasTrail) && !hideBack;
  const handleBack = () => (onBack ? onBack() : router.back());
  // Every root/detail dashboard sets contentGutter, so the title's left inset is
  // constant across navigation (no shift). The back arrow sits inline next to the
  // heading regardless.
  const useGutter = !!contentGutter;

  return (
    <header className="relative h-full py-ha-2 px-ha-0" data-component="TopBar">
      {/* Inner row shares the page content's box (max-w + centering + gutter) so
          the title lines up with the content below at every width. On gutter
          pages the left inset grows to pl-14 so the title clears the back gutter. */}
      <div className={`relative h-full flex items-center justify-between w-full lg:max-w-[1536px] lg:mx-auto lg:pr-ha-8 ${useGutter ? 'lg:pl-14' : 'lg:pl-ha-8'}`}>

      {/* Desktop: merged search + ask entry — a big centered input-shaped
          trigger that opens the command palette. */}
      {!isEditing && (
        <button
          type="button"
          onClick={openSearch}
          aria-label="Search or ask anything"
          className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-ha-3 h-11 w-[min(30rem,34vw)] px-ha-4 rounded-ha-pill bg-surface-low border border-surface-lower hover:bg-surface-mid/60 hover:border-surface-mid transition-colors group"
        >
          <Icon path={mdiMagnify} size={20} className="flex-shrink-0 text-text-secondary group-hover:text-text-primary transition-colors" />
          <span className="flex-1 min-w-0 truncate text-left text-sm text-text-tertiary group-hover:text-text-secondary transition-colors">
            Search or ask anything…
          </span>
          <kbd className="flex-shrink-0 flex items-center text-[13px] text-text-tertiary bg-surface-lower px-ha-1.5 py-0.5 rounded-ha-md font-medium">
            {shortcutHint('global.search', isMac)}
          </kbd>
        </button>
      )}
      {/* Mobile: Logo/Icon + Title with dropdown - Centered vertically on mobile */}
      <div className="flex items-center justify-between w-full lg:hidden h-full">
        {/* When immersive mode is off the dashboard surface sits inside the grey
            panel, whose content is inset by an extra px-ha-3 (12px) beyond the
            top bar's px-edge gutter. Indent the title by that same amount so it
            lines up with the content below. Skipped when a back arrow is present
            (detail pages already push the title well past the content edge) and
            in immersive mode (surface is full-bleed, so title already aligns). */}
        <div className={`flex items-center gap-ha-3 transition-[padding] duration-300 ease-out ${!immersiveMode && !showBack ? 'pl-ha-3' : ''}`}>
          {showBack && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back"
              className="flex h-11 w-11 -ml-2.5 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
            >
              <Icon path={mdiArrowLeft} size={24} />
            </button>
          )}
          {ENABLE_PULL_TO_REVEAL ? (
            <button
              className="flex items-center gap-ha-1"
              onClick={toggle}
            >
              {titleContent}
              <div className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-low transition-colors ml-1">
                <Icon
                  path={isRevealed ? mdiClose : mdiMenu}
                  size={24}
                  className="text-text-secondary"
                />
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-ha-1">
              {titleContent}
            </div>
          )}
        </div>

        {/* Mobile Actions */}
        <div className="flex items-center gap-ha-2">
          {primaryAction && (
            <button 
              onClick={primaryAction.onClick}
              className="p-ha-3 rounded-ha-xl hover:bg-surface-low text-text-secondary transition-colors"
            >
              <Icon path={primaryAction.icon} size={24} />
            </button>
          )}
          {isDashboardPage && !isEditing && (
            <button
              aria-label="Edit dashboard"
              onClick={toggleEditMode}
              className="p-ha-3 rounded-ha-xl transition-colors hover:bg-surface-low text-text-secondary"
            >
              <Icon path={pencilIcon} size={24} />
            </button>
          )}
          {!isEditing && isAdmin && (
            <button
              onClick={() => setAddMenuOpen(true)}
              className={`p-ha-3 rounded-ha-xl transition-colors ${
                theme === 'glass'
                    ? 'bg-ha-blue/20 text-ha-blue hover:bg-ha-blue/30 border border-white/10'
                  : theme === 'teenage'
                    ? 'bg-[#d48e42] text-[#161616] hover:bg-[#c07d36] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_12px_-8px_rgba(0,0,0,0.6)] border border-[#b0712e]'
                  : 'bg-ha-blue text-white hover:bg-ha-blue/90'
              }`}
            >
              <Icon path={mdiPlus} size={24} />
            </button>
          )}
        </div>
      </div>

      {/* Desktop Header Content. Back button is absolutely positioned to the
          left of the row so the title stays on the content's left edge instead
          of being pushed right by the arrow's width. */}
      <div className="relative hidden lg:flex items-center gap-ha-2">
        {showBack && (
          <button
            onClick={handleBack}
            aria-label="Back"
            className="absolute right-full mr-ha-1 top-1/2 -translate-y-1/2 p-2.5 text-text-secondary hover:text-text-primary transition-colors hover:bg-surface-low rounded-full"
          >
            <Icon path={mdiArrowLeft} size={24} />
          </button>
        )}
        {desktopTitleContent}
      </div>

      {/* Desktop Actions */}
      <div className="hidden lg:flex items-center gap-ha-2">
        {primaryAction && (
          <button 
            onClick={primaryAction.onClick}
            className="p-ha-3 rounded-ha-xl hover:bg-surface-low text-text-secondary transition-colors"
          >
            <Icon path={primaryAction.icon} size={24} />
          </button>
        )}
        {isDashboardPage && !isEditing && (
          <Tooltip content="Edit dashboard" shortcut="E" placement="bottom">
            <button
              aria-label="Edit dashboard"
              onClick={toggleEditMode}
              className="p-ha-3 rounded-ha-xl transition-colors hover:bg-surface-low text-text-secondary"
            >
              <Icon path={pencilIcon} size={24} />
            </button>
          </Tooltip>
        )}
        {!isEditing && isAdmin && (
          <button
            ref={desktopAddButtonRef}
            onClick={() => setAddMenuOpen(true)}
            className={`p-ha-3 rounded-ha-xl transition-colors ${
              theme === 'glass'
                ? 'bg-ha-blue/20 text-ha-blue hover:bg-ha-blue/30 border border-white/10'
                : theme === 'teenage'
                  ? 'bg-[#d48e42] text-[#161616] hover:bg-[#c07d36] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_12px_-8px_rgba(0,0,0,0.6)] border border-[#b0712e]'
                  : 'bg-ha-blue text-white hover:bg-ha-blue/90'
            }`}
          >
            <Icon path={mdiPlus} size={24} />
          </button>
        )}
      </div>
      </div>

      <AddMenu
        isOpen={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        anchorRef={desktopAddButtonRef}
      />
    </header>
  );
}
