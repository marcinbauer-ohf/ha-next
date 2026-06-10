'use client';

import { useMemo, type CSSProperties } from 'react';
import { useImmersiveMode } from './useImmersiveMode';

export function useDesktopImmersivePageLayout() {
  const { immersiveMode, immersivePhase } = useImmersiveMode();
  const isImmersiveFixed = immersivePhase !== 'normal';
  // On mobile, immersive mode renders content edge-to-edge (full-bleed) just like
  // the dashboard does: the grey surface meets the screen edges (square corners,
  // no side gutter). `immersivePhase` is always 'normal' on mobile, so the fixed
  // desktop treatment never collides with this. immersiveMode defaults on for
  // mobile, so content pages are full-bleed by default and fall back to the inset
  // card only when the user turns immersive off.
  const isMobileImmersive = immersiveMode && !isImmersiveFixed;

  const contentStyle = useMemo<CSSProperties | undefined>(() => {
    if (!isImmersiveFixed) {
      return undefined;
    }

    const statusBarHeight = 'calc(var(--ha-space-2) + 48px + var(--ha-edge-padding))';
    const compensatingPadding = {
      paddingLeft: 'calc(2 * var(--ha-edge-padding) + 64px)',
      paddingTop: 'calc(var(--ha-edge-padding) + 64px)',
      paddingRight: 'var(--ha-edge-padding)',
      paddingBottom: 0,
    };
    const expandedPadding = {
      paddingLeft: 'var(--ha-edge-padding)',
      paddingTop: 'var(--ha-edge-padding)',
      paddingRight: 'var(--ha-edge-padding)',
      paddingBottom: 0,
    };

    return {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: statusBarHeight,
      zIndex: 5,
      margin: 0,
      overflow: 'hidden',
      ...(immersivePhase === 'preparing'
        ? {
            ...compensatingPadding,
            transition: 'none',
          }
        : immersivePhase === 'expanded'
          ? {
              ...expandedPadding,
              transition: 'padding 300ms ease-out',
            }
          : {
              ...compensatingPadding,
              transition: 'padding 300ms ease-out',
            }),
    };
  }, [immersivePhase, isImmersiveFixed]);

  const contentPaddingClasses = isImmersiveFixed
    ? ''
    : isMobileImmersive
      // Mobile full-bleed: drop the side gutter so the surface reaches the screen
      // edges; keep the desktop edge padding (lg:) untouched. Mirrors the dashboard.
      ? 'pb-0 lg:px-edge lg:pb-ha-0 lg:pr-edge'
      : 'px-edge mt-[calc(var(--ha-space-1)*(1-var(--mobile-ui-hidden-padding,0)))] pt-[calc(var(--ha-edge-padding)*var(--mobile-ui-hidden-padding,0))] pb-[calc(var(--ha-edge-padding)*var(--mobile-ui-hidden-padding,0))] lg:mt-0 lg:pt-0 lg:pb-ha-0 lg:pr-edge';

  // Square the surface corners on mobile full-bleed; keep the rounded card on desktop.
  const surfaceRoundingClass = isMobileImmersive ? 'rounded-none lg:rounded-ha-3xl' : 'rounded-ha-3xl';

  const contentTransitionClasses = immersivePhase === 'normal'
    ? 'transition-[flex,height,opacity,padding] duration-300 ease-out lg:transition-[flex,height,opacity]'
    : '';

  return {
    immersiveMode,
    immersivePhase,
    isImmersiveFixed,
    isMobileImmersive,
    contentPaddingClasses,
    contentTransitionClasses,
    contentStyle,
    surfaceRoundingClass,
  };
}
