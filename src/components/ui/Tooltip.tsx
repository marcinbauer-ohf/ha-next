'use client';

import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: ReactNode;
  delay?: number;
  hideDelay?: number;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, delay = 300, hideDelay = 0, placement = 'top' }: TooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 120; // approximate width for calculation
    const tooltipHeight = 32; // approximate height
    const spacing = 8;
    
    let top = 0;
    let left = 0;

    switch (placement) {
      case 'right':
        left = rect.right + spacing;
        top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
        break;
      case 'left':
        left = rect.left - tooltipWidth - spacing;
        top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
        break;
      case 'bottom':
        left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        top = rect.bottom + spacing;
        break;
      case 'top':
      default:
        left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        top = rect.top - tooltipHeight - spacing;
        break;
    }

    // Viewport boundary checks
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 8) left = 8;
    if (left + tooltipWidth > viewportWidth - 8) left = viewportWidth - tooltipWidth - 8;
    if (top < 8) top = 8;
    if (top + tooltipHeight > viewportHeight - 8) top = viewportHeight - tooltipHeight - 8;

    setPosition({ top, left });
  }, [placement]);

  const isVisible = isHovered;

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
    }

    showTimeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsHovered(true);
      showTimeoutRef.current = null;
    }, delay);
  };

  const handleMouseLeave = () => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    if (hideDelay > 0) {
      hideTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
        hideTimeoutRef.current = null;
      }, hideDelay);
      return;
    }

    setIsHovered(false);
  };

  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = null;
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const frameId = window.requestAnimationFrame(() => {
      updatePosition();
    });

    const handleReposition = () => updatePosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isVisible, updatePosition]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-flex"
      >
        {children}
      </div>
      {typeof document !== 'undefined' && isVisible && createPortal(
        <div
          className="fixed z-[200] px-ha-2 py-ha-1 bg-surface-default border border-surface-lower rounded-ha-lg shadow-lg shadow-black/20 transition-all duration-300 ease-out pointer-events-none"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'scale(1)' : 'scale(0.9)',
          }}
        >
          <span className="text-xs text-text-primary whitespace-nowrap font-medium">
            {content}
          </span>
        </div>,
        document.body
      )}
    </>
  );
}
