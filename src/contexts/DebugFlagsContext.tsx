'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/**
 * Prototype-only debug flags shared between the settings "Prototype & Debug"
 * page and the command palette so toggling from either stays in sync.
 *
 * Persisted to localStorage like the other ha-flag-* keys. Both default off.
 */

// Prototyping: strip the Home Center + assistant chrome. Desktop loses the whole
// bottom bar, mobile loses the Home Center tab, and both lose the settings entry.
const LS_HIDE_HOME_CENTER_KEY = 'ha-flag-hide-home-center';
// Prototyping: drop the product render from device cards. The mdi entity icon
// takes its place beside the name/state and the cards shrink a lattice step.
const LS_HIDE_CARD_IMAGES_KEY = 'ha-flag-hide-card-images';
// Both default ON — they gate shipped behaviour, so only an explicit '0' opts
// out. Sidebar hover preview thumbnails, and the home dashboard's filter pill.
const LS_SIDEBAR_PREVIEWS_KEY = 'ha-flag-sidebar-previews';
const LS_DASHBOARD_FILTER_KEY = 'ha-flag-dashboard-filter';
// Prototyping: let the mobile bottom nav hide itself again (on scroll-down and
// after 10s of inactivity). Defaults OFF — the nav currently stays put.
const LS_MOBILE_NAV_AUTOHIDE_KEY = 'ha-flag-mobile-nav-autohide';

interface DebugFlagsContextValue {
  /** true = desktop bottom bar gone, Home Center hidden from mobile nav + settings. */
  hideHomeCenterEnabled: boolean;
  toggleHideHomeCenter: () => void;
  /** true = no product render on device cards; entity icon + shorter cards instead. */
  hideCardImagesEnabled: boolean;
  toggleHideCardImages: () => void;
  /** Snapshot thumbnail in the sidebar's hover tooltip; off falls back to the label pill. */
  sidebarPreviewsEnabled: boolean;
  toggleSidebarPreviews: () => void;
  /** Floating floor/grouping pill on the home dashboard. Off also drops the floor filter. */
  dashboardFilterEnabled: boolean;
  toggleDashboardFilter: () => void;
  /** Mobile bottom nav hides on scroll-down and after 10s idle. Off pins it. */
  mobileNavAutoHideEnabled: boolean;
  toggleMobileNavAutoHide: () => void;
}

const DebugFlagsContext = createContext<DebugFlagsContextValue | undefined>(undefined);

export function DebugFlagsProvider({ children }: { children: ReactNode }) {
  const [hideHomeCenterEnabled, setHideHomeCenterEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_HIDE_HOME_CENTER_KEY) === '1';
  });

  const toggleHideHomeCenter = useCallback(() => {
    setHideHomeCenterEnabledState((prev) => {
      const next = !prev;
      localStorage.setItem(LS_HIDE_HOME_CENTER_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const [hideCardImagesEnabled, setHideCardImagesEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_HIDE_CARD_IMAGES_KEY) === '1';
  });

  const toggleHideCardImages = useCallback(() => {
    setHideCardImagesEnabledState((prev) => {
      const next = !prev;
      localStorage.setItem(LS_HIDE_CARD_IMAGES_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const [sidebarPreviewsEnabled, setSidebarPreviewsEnabledState] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(LS_SIDEBAR_PREVIEWS_KEY) !== '0';
  });

  const toggleSidebarPreviews = useCallback(() => {
    setSidebarPreviewsEnabledState((prev) => {
      const next = !prev;
      localStorage.setItem(LS_SIDEBAR_PREVIEWS_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const [dashboardFilterEnabled, setDashboardFilterEnabledState] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(LS_DASHBOARD_FILTER_KEY) !== '0';
  });

  const toggleDashboardFilter = useCallback(() => {
    setDashboardFilterEnabledState((prev) => {
      const next = !prev;
      localStorage.setItem(LS_DASHBOARD_FILTER_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const [mobileNavAutoHideEnabled, setMobileNavAutoHideEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_MOBILE_NAV_AUTOHIDE_KEY) === '1';
  });

  const toggleMobileNavAutoHide = useCallback(() => {
    setMobileNavAutoHideEnabledState((prev) => {
      const next = !prev;
      localStorage.setItem(LS_MOBILE_NAV_AUTOHIDE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  return (
    <DebugFlagsContext.Provider
      value={{
        hideHomeCenterEnabled,
        toggleHideHomeCenter,
        hideCardImagesEnabled,
        toggleHideCardImages,
        sidebarPreviewsEnabled,
        toggleSidebarPreviews,
        dashboardFilterEnabled,
        toggleDashboardFilter,
        mobileNavAutoHideEnabled,
        toggleMobileNavAutoHide,
      }}
    >
      {children}
    </DebugFlagsContext.Provider>
  );
}

export function useDebugFlags() {
  const context = useContext(DebugFlagsContext);
  if (context === undefined) {
    throw new Error('useDebugFlags must be used within a DebugFlagsProvider');
  }
  return context;
}
