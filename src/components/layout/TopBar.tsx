'use client';

import { useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { MdiIcon } from '../ui/MdiIcon';
import { HALogo } from '../ui/HALogo';
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
  const { title, subtitle, icon, primaryAction, onBack } = useHeader();
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

  const titleContent = subtitle ? (
    <div className="flex flex-col leading-none gap-0.5 text-left">
      {subtitle.trim() && <span className="text-xs text-text-secondary capitalize">{subtitle}</span>}
      <span className="text-base font-semibold text-text-primary capitalize">{title}</span>
    </div>
  ) : (
    <span className="text-lg font-semibold text-text-primary capitalize">{title}</span>
  );

  const desktopTitleContent = subtitle ? (
    <div className="flex flex-col leading-none gap-0.5 text-left">
      {subtitle.trim() && <span className="text-xs text-text-secondary capitalize">{subtitle}</span>}
      <span className="text-xl font-semibold text-text-primary capitalize">{title}</span>
    </div>
  ) : (
    <h1 className="text-2xl font-semibold text-text-primary capitalize">
      {title}
    </h1>
  );

  return (
    <header className="flex items-center justify-between h-full py-ha-2 px-ha-0 lg:pl-4" data-component="TopBar">
      {/* Mobile: Logo/Icon + Title with dropdown - Centered vertically on mobile */}
      <div className="flex items-center justify-between w-full lg:hidden h-full">
        <div className="flex items-center gap-ha-3">
          {icon ? (
            icon.includes(' ')
              ? <Icon path={icon} size={24} className="text-text-secondary" />
              : <MdiIcon icon={icon} size={24} className="text-text-secondary" />
          ) : (
            <HALogo size={24} />
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
                    ? 'bg-ha-blue/20 text-ha-blue backdrop-blur-md hover:bg-ha-blue/30 border border-white/10'
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

      {/* Desktop Header Content */}
      <div className="hidden lg:flex items-center gap-ha-2">
        {subtitle && (
          <button 
            onClick={() => onBack ? onBack() : router.back()}
            className="p-1 -ml-1 text-text-secondary hover:text-text-primary transition-colors hover:bg-surface-low rounded-full"
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
                ? 'bg-ha-blue/20 text-ha-blue backdrop-blur-md hover:bg-ha-blue/30 border border-white/10'
                : theme === 'teenage'
                  ? 'bg-[#d48e42] text-[#161616] hover:bg-[#c07d36] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_12px_-8px_rgba(0,0,0,0.6)] border border-[#b0712e]'
                  : 'bg-ha-blue text-white hover:bg-ha-blue/90'
            }`}
          >
            <Icon path={mdiPlus} size={24} />
          </button>
        )}
      </div>

      <AddMenu
        isOpen={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        anchorRef={desktopAddButtonRef}
      />
    </header>
  );
}
