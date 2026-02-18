'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: ReactNode;
  delay?: number;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, delay = 300, placement = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
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
  };

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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
      {mounted && isVisible && createPortal(
        <div
          className="fixed z-[200] px-ha-2 py-ha-1 bg-surface-default border border-surface-lower rounded-ha-pill shadow-lg shadow-black/20 transition-all duration-300 ease-out pointer-events-none"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'scale(1)' : 'scale(0.9)',
          }}
        >
          <span className="text-[11px] text-text-primary whitespace-nowrap font-medium">
            {content}
          </span>
        </div>,
        document.body
      )}
    </>
  );
}
