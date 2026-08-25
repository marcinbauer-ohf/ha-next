'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { RollingText } from '../ui/RollingText';
import { AddMenu } from '../ui/AddMenu';
import { Tooltip } from '../ui/Tooltip';
import { shortcutHint, useIsMacPlatform } from '@/lib/keyboardShortcuts';
import { CONTENT_MAX, CONTENT_GUTTER } from '@/lib/layout';
import { useHeader, usePullToRevealContext, ENABLE_PULL_TO_REVEAL, useEditMode, useSearchContext, useAssistantContext } from '@/contexts';
import { useTheme, useImmersiveMode, useHomeAssistant } from '@/hooks';
import {
  mdiPencil,
  mdiCheck,
  mdiPlus,
  mdiMenu,
  mdiClose,
  mdiArrowLeft,
  mdiMagnify,
  mdiCreation,
} from '@mdi/js';

export function TopBar() {
  const { theme } = useTheme();
  const { title, subtitle, breadcrumbs, primaryAction, editAction, onBack, hideBack, sectionCrumb, sectionCrumbReverse } = useHeader();
  const { isRevealed, toggle } = usePullToRevealContext();
  const { isEditing, toggleEditMode } = useEditMode();
  const { openSearch } = useSearchContext();
  const { openAssistant } = useAssistantContext();
  const { immersiveMode } = useImmersiveMode();
  const { isAdmin } = useHomeAssistant();
  const router = useRouter();
  const pathname = usePathname();
  const isMac = useIsMacPlatform();
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  // Desktop search pill: say "Ask" once on load, then tuck the word away.
  const [showAskLabel, setShowAskLabel] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowAskLabel(false), 1800);
    return () => clearTimeout(t);
  }, []);
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

  // `centered` is the back-arrow shape on mobile: the heading sits on the bar's
  // centre axis instead of being pushed off it by the arrow.
  const mobileTitle = (centered: boolean) => (
    <div className={`flex flex-col leading-none gap-0.5 min-w-0 ${centered ? 'items-center text-center' : 'text-left'}`}>
      {subtitle?.trim() && collapseEyebrow(<span className="text-xs text-text-secondary capitalize">{subtitle}</span>)}
      <RollingText
        text={title}
        direction={titleDirection}
        reverse={titleReverse}
        className={`${subtitle ? 'text-lg' : 'text-2xl'} font-semibold text-text-primary capitalize`}
      />
      {sectionCrumbLine}
    </div>
  );

  const desktopEyebrow = hasTrail ? (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-text-secondary min-w-0 truncate">
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
    <span className="text-xs text-text-secondary capitalize truncate">{subtitle}</span>
  ) : null;

  // Single persistent flex-col + RollingText for every header shape, so the
  // title rolls (rather than hard-remounts) when moving between a standalone
  // page like Home and a subtitled/breadcrumbed one like Settings. Standalone
  // gets the larger 2xl size; eyebrow/breadcrumb shapes use xl.
  const desktopStandalone = !hasTrail && !subtitle;
  const desktopTitleSize = desktopStandalone ? 'text-2xl' : 'text-xl';
  const desktopTitleContent = (
    // min-w-0 + truncate: the row caps this block at the centred search pill's
    // left edge (half the row, less half the pill), so a long title ellipsises
    // instead of running underneath it.
    <div className="flex flex-col leading-none gap-0.5 text-left min-w-0 max-w-full">
      {desktopEyebrow && collapseEyebrow(desktopEyebrow)}
      <h1 className={`${desktopTitleSize} leading-none font-semibold text-text-primary capitalize truncate`}>
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

  // Edit affordance sits next to the heading (both breakpoints), sized and
  // coloured like the sidebar's arrange pencil rather than the 24px actions.
  // One pencil, two jobs: on a dashboard it toggles layout edit mode; on a page
  // that claims it (a room → its area settings) it opens that page's editor.
  const pencilTarget = editAction
    ? { icon: mdiPencil, label: editAction.label, onClick: editAction.onClick }
    : isDashboardPage && !isEditing
      ? { icon: pencilIcon, label: pencilLabel === 'Edit' ? 'Edit dashboard' : pencilLabel, onClick: toggleEditMode }
      : null;
  const editPencil = pencilTarget && !isEditing && (
    <IconButton icon={pencilTarget.icon} label={pencilTarget.label} size="sm" tone="quiet" shape="square" exact onClick={pencilTarget.onClick} />
  );
  return (
    <header className="group/bar relative h-full py-ha-2 px-ha-0" data-component="TopBar">
      {/* Left inset: the shell's rail column (settings' section list) spans this
          row, so the row inside starts where the content column does. Its shell
          then centres on that same column — which is what makes the heading and
          the action buttons land on the page content's own left/right edges at
          every width, clamp included. 0 on every route without a rail. */}
      <div className="h-full xl:pl-[var(--app-rail-w,0px)] transition-[padding] duration-300 ease-out">
      {/* Inner row shares the exact content shell (max-w + centering + gutters)
          used by every page below, so the title/breadcrumbs on the left and the
          action buttons on the right line up with the content at every width. */}
      <div className={`h-full ${CONTENT_MAX} ${CONTENT_GUTTER}`}>
      {/* Inner box = the content column exactly, with the shell's asymmetric
          gutters already taken off — so the centred search lands on the true
          midpoint between the heading and the actions. */}
      <div className="relative h-full w-full flex items-center justify-between">

      {/* Desktop: merged search + ask entry — a big centered input-shaped
          trigger that opens the command palette. Two controls in one pill, so
          the outer shell is a div: search takes the whole field, Ask goes
          straight to the assistant instead of the palette's "ask" row.

          Centred on the row's content box — the span between the heading on the
          left and the action buttons on the right, which is the page content's
          own column. Sits inside the inner row (not the padded shell) because
          the shell's gutters are asymmetric, and half of that difference would
          otherwise pull the pill off the midpoint. */}
      {!isEditing && (
        <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 items-center h-11 w-[min(30rem,34vw)] pl-ha-4 pr-ha-2 rounded-full bg-surface-low hover:bg-surface-mid/60 transition-colors group">
          <button
            type="button"
            onClick={openSearch}
            aria-label="Search"
            title={`Search (${shortcutHint('global.search', isMac)})`}
            className="flex flex-1 min-w-0 items-center gap-ha-3 h-full text-left"
          >
            <Icon path={mdiMagnify} size={20} className="flex-shrink-0 text-text-secondary group-hover:text-text-primary transition-colors" />
            <span className="flex-1 min-w-0 truncate text-sm text-text-tertiary group-hover:text-text-secondary transition-colors">
              Search or ask anything…
            </span>
          </button>
          <button
            type="button"
            onClick={() => openAssistant()}
            aria-label="Ask your home"
            className="flex-shrink-0 flex h-7 items-center px-ha-2 rounded-ha-lg bg-surface-lower text-text-secondary text-[13px] font-medium leading-none hover:bg-surface-mid hover:text-text-primary transition-colors"
          >
            <Icon path={mdiCreation} size={15} exact />
            {/* The word introduces the button on first load, then collapses
                away to the bare sparkle. Grid columns so it slides shut on its
                own width without measuring anything. */}
            <span
              className="grid transition-[grid-template-columns,opacity] duration-500 ease-out"
              style={{ gridTemplateColumns: showAskLabel ? '1fr' : '0fr', opacity: showAskLabel ? 1 : 0 }}
            >
              <span className="overflow-hidden min-w-0 whitespace-nowrap pl-ha-1 pr-ha-1">Ask</span>
            </span>
          </button>
        </div>
      )}
      {/* Mobile: Logo/Icon + Title with dropdown - Centered vertically on mobile */}
      <div className="relative flex items-center justify-between w-full lg:hidden h-full">
        {/* Indent the title onto the content's own left edge. Two parts, both
            measured off what's under it: the section headings below carry the
            card's inset (`--dct-pad`, same rule as SectionHeader), and when
            immersive mode is off the surface also sits inside the grey panel,
            one extra 12px in from the top bar's px-edge gutter. Skipped when a
            back arrow is present — detail pages already push the title well
            past the content edge. */}
        <div
          className="flex items-center gap-ha-3 transition-[padding] duration-300 ease-out"
          style={{ paddingLeft: showBack ? undefined : `calc(${immersiveMode ? '0px' : 'var(--ha-space-3)'} + var(--dct-pad, 10px))` }}
        >
          {showBack && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back"
              // relative z-10: sit above the title's RollingText fade-gutter
              // (negative-margin box) so it can't steal the tap on the arrow.
              className="relative z-10 flex h-11 w-11 -ml-2.5 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
            >
              <Icon path={mdiArrowLeft} size={24} />
            </button>
          )}
          {!showBack && (ENABLE_PULL_TO_REVEAL ? (
            <button
              className="flex items-center gap-ha-1"
              onClick={toggle}
            >
              {mobileTitle(false)}
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
              {mobileTitle(false)}
            </div>
          ))}
          {!showBack && editPencil}
        </div>

        {/* Back pages: heading on the bar's centre axis, so the arrow on the
            left and the actions on the right don't shift it off-centre.
            pointer-events-none keeps the (non-interactive) heading from eating
            taps meant for the actions it may overlap on narrow screens. */}
        {showBack && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 flex max-w-[62%] -translate-x-1/2 -translate-y-1/2 items-center gap-ha-1">
            {mobileTitle(true)}
            {editPencil && <span className="pointer-events-auto">{editPencil}</span>}
          </div>
        )}

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
      <div className="relative hidden lg:flex items-center gap-ha-2 min-w-0 max-w-[calc(50%-min(15rem,17vw)-1rem)]">
        {showBack && (
          <button
            onClick={handleBack}
            aria-label="Back"
            // z-10: the title's RollingText has an invisible 1em fade-gutter
            // (paddingInline + negative margin) that overlaps the arrow's right
            // side and would otherwise steal the hover — sit above it.
            className="absolute right-full mr-ha-1 top-1/2 -translate-y-1/2 z-10 p-ha-3 text-text-secondary hover:text-text-primary transition-colors hover:bg-surface-low rounded-full"
          >
            <Icon path={mdiArrowLeft} size={24} />
          </button>
        )}
        {desktopTitleContent}
        {editPencil && (
          // Desktop: the pencil is a secondary affordance, so it stays faded
          // out until the bar is hovered (or it takes keyboard focus).
          <span className="opacity-0 transition-opacity duration-200 group-hover/bar:opacity-100 focus-within:opacity-100">
            <Tooltip content={pencilTarget!.label} shortcut={editAction ? undefined : 'E'} placement="bottom">
              {editPencil}
            </Tooltip>
          </span>
        )}
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
