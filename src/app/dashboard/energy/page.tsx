'use client';

import { useState, useEffect, useRef } from 'react';
import { PullToRevealPanel } from '@/components/sections';
import { usePullToRevealContext, useHeader } from '@/contexts';
import { useTheme } from '@/hooks';
import { mdiFlash } from '@mdi/js';

type EnergyTab = 'now' | 'all';

function EnergyTabs({ activeTab, onTabChange }: { activeTab: EnergyTab; onTabChange: (tab: EnergyTab) => void }) {
  return (
    <div className="flex gap-ha-2">
      <button
        onClick={() => onTabChange('now')}
        className={`px-ha-4 py-ha-2 rounded-ha-pill text-sm font-medium transition-colors ${
          activeTab === 'now'
            ? 'bg-fill-primary-normal text-ha-blue'
            : 'bg-surface-low text-text-secondary hover:bg-surface-default'
        }`}
      >
        Now
      </button>
      <button
        onClick={() => onTabChange('all')}
        className={`px-ha-4 py-ha-2 rounded-ha-pill text-sm font-medium transition-colors ${
          activeTab === 'all'
            ? 'bg-fill-primary-normal text-ha-blue'
            : 'bg-surface-low text-text-secondary hover:bg-surface-default'
        }`}
      >
        All
      </button>
    </div>
  );
}

function NowContent() {
  return (
    <div className="space-y-ha-4">
      {/* Energy Flow Hero - Basic card */}
      <div className="bg-surface-low rounded-ha-xl p-ha-4 h-40" />

      {/* Live breakdown - Basic cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-ha-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-low rounded-ha-xl p-ha-3 h-24" />
        ))}
      </div>

      {/* Details - Basic cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-ha-3">
        <div className="bg-surface-low rounded-ha-xl p-ha-4 h-32" />
        <div className="bg-surface-low rounded-ha-xl p-ha-4 h-32" />
      </div>

      {/* Active Devices - Basic cards */}
      <div>
        <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">Active Devices</div>
        <div className="space-y-ha-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface-low rounded-ha-xl h-16" />
          ))}
        </div>
      </div>
    </div>
  );
}

function AllContent() {
  return (
    <div className="space-y-ha-4">
      {/* Summary Stats - Basic cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-ha-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-low rounded-ha-xl p-ha-3 h-24" />
        ))}
      </div>

      {/* Consumption vs Production - Basic cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-ha-3">
        <div className="bg-surface-low rounded-ha-xl p-ha-4 h-48" />
        <div className="bg-surface-low rounded-ha-xl p-ha-4 h-48" />
      </div>

      {/* Usage Chart - Basic card */}
      <div>
        <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">Usage History</div>
        <div className="bg-surface-low rounded-ha-xl p-ha-4 h-64" />
      </div>

      {/* Energy Sources - Basic card */}
      <div>
        <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">Energy Sources</div>
        <div className="bg-surface-low rounded-ha-xl p-ha-4 h-32" />
      </div>

      {/* Device Consumption - Basic cards */}
      <div>
        <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">Device Consumption</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-ha-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-surface-low rounded-ha-xl h-16" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EnergyDashboardPage() {
  const { isRevealed } = usePullToRevealContext();
  const [activeTab, setActiveTab] = useState<EnergyTab>('now');
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);
  const { background } = useTheme();
  const scrollableRef = useRef<HTMLElement | null>(null);
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader({ title: 'Energy', icon: mdiFlash });
  }, [setHeader]);

  // Monitor scroll position to show/hide gradients
  useEffect(() => {
    const scrollElement = scrollableRef.current;
    if (!scrollElement) return;

    const updateGradients = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const threshold = 10;
      setShowTopGradient(scrollTop > threshold);

      const hasOverflow = scrollHeight > clientHeight + threshold;
      setShowBottomGradient(hasOverflow && scrollTop + clientHeight < scrollHeight - threshold);
    };

    updateGradients();
    scrollElement.addEventListener('scroll', updateGradients);
    window.addEventListener('resize', updateGradients);

    return () => {
      scrollElement.removeEventListener('scroll', updateGradients);
      window.removeEventListener('resize', updateGradients);
    };
  }, []);


  return (
    <>
      {/* TopBar row - rendered by AppShell */}

      {/* Pull to reveal - drag handle between TopBar and dashboard (Mobile only) */}
      <PullToRevealPanel />

      {/* Main content row - shrinks as panel expands */}
      <div className={`min-h-0 overflow-hidden px-edge pb-20 mt-1 lg:mt-0 lg:pb-ha-0 lg:pr-edge transition-all duration-300 ease-out ${
        isRevealed ? 'flex-none h-0 opacity-0' : 'flex-1'
      }`}>
        <div className="h-full bg-surface-lower overflow-hidden rounded-ha-3xl relative">
          {/* Top scroll gradient - absolute to container */}
          {showTopGradient && background !== 'image' && background !== 'gradient' && (
            <div className="absolute top-0 left-0 right-0 lg:left-14 lg:right-ha-5 h-12 pointer-events-none bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300" />
          )}
          {/* Bottom scroll gradient - absolute to container */}
          {showBottomGradient && background !== 'image' && background !== 'gradient' && (
            <div className="absolute bottom-0 left-0 right-0 lg:left-14 lg:right-ha-5 h-12 pointer-events-none bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300" />
          )}
          <div 
            ref={(el) => { scrollableRef.current = el; }}
            className="h-full overflow-y-auto overscroll-none touch-pan-y relative px-ha-4 py-ha-4 lg:pl-14 lg:pr-ha-5 lg:pt-ha-5 lg:pb-ha-5" 
            data-scrollable="dashboard"
          >

            {/* Tabs - sticky on mobile */}
            <div
              className="sticky top-0 -mx-ha-3 px-ha-3 lg:-ml-14 lg:pl-14 lg:-mr-ha-5 lg:pr-ha-5 pt-ha-1 pb-ha-3 z-30 backdrop-blur-md"
              style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--ha-color-surface-lower) 80%, transparent), transparent)' }}
            >
              <EnergyTabs activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            {/* Tab content */}
            {activeTab === 'now' ? <NowContent /> : <AllContent />}
          </div>
        </div>
      </div>
    </>
  );
}
