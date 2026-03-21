'use client';

import { useMemo, type CSSProperties } from 'react';
import { useImmersiveMode } from './useImmersiveMode';

export function useDesktopImmersivePageLayout() {
  const { immersivePhase } = useImmersiveMode();
  const isImmersiveFixed = immersivePhase !== 'normal';

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
    : 'px-edge mt-[calc(var(--ha-space-1)*(1-var(--mobile-ui-hidden-padding,0)))] pt-[calc(var(--ha-edge-padding)*var(--mobile-ui-hidden-padding,0))] pb-[calc(var(--ha-edge-padding)*var(--mobile-ui-hidden-padding,0))] lg:mt-0 lg:pt-0 lg:pb-ha-0 lg:pr-edge';

  const contentTransitionClasses = immersivePhase === 'normal'
    ? 'transition-[flex,height,opacity,padding] duration-300 ease-out lg:transition-[flex,height,opacity]'
    : '';

  return {
    immersivePhase,
    isImmersiveFixed,
    contentPaddingClasses,
    contentTransitionClasses,
    contentStyle,
  };
}
