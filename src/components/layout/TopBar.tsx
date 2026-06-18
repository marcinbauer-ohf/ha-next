'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { RollingText } from '../ui/RollingText';
import { AddMenu } from '../ui/AddMenu';
import { useHeader, usePullToRevealContext, ENABLE_PULL_TO_REVEAL, useEditMode } from '@/contexts';
import { useTheme } from '@/hooks';
import {
  mdiPencil,
  mdiCheck,
  mdiPlus,
  mdiMenu,
  mdiClose,
  mdiArrowLeft,
} from '@mdi/js';

export function TopBar() {
  const { theme } = useTheme();
  const { title, subtitle, breadcrumbs, primaryAction, onBack, hideBack, sectionCrumb, sectionCrumbReverse } = useHeader();
  const { isRevealed, toggle } = usePullToRevealContext();
  const { isEditing, toggleEditMode } = useEditMode();
  const router = useRouter();
  const pathname = usePathname();
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

  const titleContent = (
    <div className="flex flex-col leading-none gap-0.5 text-left">
      {subtitle?.trim() && <span className="text-xs text-text-secondary capitalize">{subtitle}</span>}
      <RollingText
        text={title}
        className={`${subtitle ? 'text-base' : 'text-lg'} font-semibold text-text-primary capitalize`}
      />
      {sectionCrumbLine}
    </div>
  );

  const hasTrail = !!breadcrumbs && breadcrumbs.length > 0;
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

  // Pick the title roll axis from how the breadcrumb trail is changing:
  // entering a detail screen (trail appears) → horizontal in from the right;
  // leaving it via back (trail disappears) → horizontal in from the left;
  // detail→detail keeps the forward slide; section↔section children stay
  // vertical (the dashboard-value roll). prevHasTrail is read during render and
  // updated after paint, so it reflects the *previous* title at change time.
  const prevHasTrail = useRef(hasTrail);
  let titleDirection: 'vertical' | 'horizontal' = 'vertical';
  let titleReverse = false;
  if (hasTrail) {
    titleDirection = 'horizontal'; // into / between detail screens
  } else if (prevHasTrail.current) {
    titleDirection = 'horizontal'; // backing out of a detail screen
    titleReverse = true;
  }
  useEffect(() => {
    prevHasTrail.current = hasTrail;
  }, [hasTrail]);

  // Single persistent flex-col + RollingText for every header shape, so the
  // title rolls (rather than hard-remounts) when moving between a standalone
  // page like Home and a subtitled/breadcrumbed one like Settings. Standalone
  // gets the larger 2xl size; eyebrow/breadcrumb shapes use xl.
  const desktopStandalone = !hasTrail && !subtitle;
  const desktopTitleSize = desktopStandalone ? 'text-2xl' : 'text-xl';
  const desktopTitleContent = (
    <div className="flex flex-col leading-none gap-0.5 text-left">
      {desktopEyebrow}
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

  return (
    <header className="h-full py-ha-2 px-ha-0" data-component="TopBar">
      {/* Inner row shares the page content's box (max-w + centering + gutter) so
          the title lines up with the content below at every width. */}
      <div className="h-full flex items-center justify-between w-full lg:max-w-[1536px] lg:mx-auto lg:px-ha-8">
      {/* Mobile: Logo/Icon + Title with dropdown - Centered vertically on mobile */}
      <div className="flex items-center justify-between w-full lg:hidden h-full">
        <div className="flex items-center gap-ha-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
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
          {!isEditing && (
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
        {(subtitle || hasTrail) && !hideBack && (
          <button
            onClick={() => onBack ? onBack() : router.back()}
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
          <button
            aria-label="Edit dashboard"
            onClick={toggleEditMode}
            className="p-ha-3 rounded-ha-xl transition-colors hover:bg-surface-low text-text-secondary"
          >
            <Icon path={pencilIcon} size={24} />
          </button>
        )}
        {!isEditing && (
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
