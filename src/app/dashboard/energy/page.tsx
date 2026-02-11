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
      {/* Energy Flow Hero */}
      <div className="bg-surface-low rounded-ha-xl p-ha-4">
        <div className="flex items-center justify-between mb-ha-4">
          <div>
            <div className="text-sm text-text-secondary mb-ha-1">Current Usage</div>
            <div className="text-4xl font-semibold text-text-primary">2.4 kW</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-text-secondary mb-ha-1">Cost Rate</div>
            <div className="text-lg font-medium text-yellow-500">Peak Hours</div>
            <div className="text-xs text-text-secondary">$0.28/kWh</div>
          </div>
        </div>
        {/* Energy flow visualization */}
        <div className="grid grid-cols-3 gap-ha-2 text-center">
          <div className="bg-surface-lower rounded-ha-lg p-ha-3">
            <div className="text-yellow-500 text-2xl font-semibold">0.6</div>
            <div className="text-xs text-text-secondary">kW Solar</div>
          </div>
          <div className="bg-surface-lower rounded-ha-lg p-ha-3">
            <div className="text-red-500 text-2xl font-semibold">1.8</div>
            <div className="text-xs text-text-secondary">kW Grid</div>
          </div>
          <div className="bg-surface-lower rounded-ha-lg p-ha-3">
            <div className="text-green-500 text-2xl font-semibold">72%</div>
            <div className="text-xs text-text-secondary">Battery</div>
          </div>
        </div>
      </div>

      {/* Live breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-ha-3">
        {[
          { name: 'From Grid', value: '1.8 kW', subtext: '$0.50/hr', color: 'text-red-500', bg: 'bg-red-500/10' },
          { name: 'Solar Production', value: '0.6 kW', subtext: '25% capacity', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
          { name: 'Battery', value: '72%', subtext: 'Charging', color: 'text-green-500', bg: 'bg-green-500/10' },
          { name: 'To Grid', value: '0 kW', subtext: 'Not exporting', color: 'text-ha-blue', bg: 'bg-ha-blue/10' },
        ].map((item) => (
          <div key={item.name} className={`${item.bg} rounded-ha-xl p-ha-3`}>
            <div className="text-xs text-text-secondary mb-ha-1">{item.name}</div>
            <div className={`text-xl font-semibold ${item.color}`}>{item.value}</div>
            <div className="text-xs text-text-secondary mt-ha-1">{item.subtext}</div>
          </div>
        ))}
      </div>

      {/* Solar Details */}
      <div className="bg-surface-low rounded-ha-xl p-ha-4">
        <div className="text-sm font-medium text-text-primary mb-ha-3">Solar Production</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-ha-3">
          <div>
            <div className="text-xs text-text-secondary">Today</div>
            <div className="text-lg font-medium text-text-primary">4.2 kWh</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">Peak Today</div>
            <div className="text-lg font-medium text-text-primary">2.1 kW</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">Efficiency</div>
            <div className="text-lg font-medium text-text-primary">89%</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">Savings Today</div>
            <div className="text-lg font-medium text-green-500">$1.18</div>
          </div>
        </div>
      </div>

      {/* Active devices */}
      <div>
        <div className="flex items-center justify-between mb-ha-3">
          <div className="text-sm font-medium text-text-primary">Active Devices</div>
          <div className="text-xs text-text-secondary">8 devices consuming power</div>
        </div>
        <div className="space-y-ha-2">
          {[
            { name: 'Air Conditioner', power: '1.2 kW', percent: 50, room: 'Living Room' },
            { name: 'Washing Machine', power: '0.8 kW', percent: 33, room: 'Laundry' },
            { name: 'Refrigerator', power: '0.15 kW', percent: 6, room: 'Kitchen' },
            { name: 'Desktop Computer', power: '0.12 kW', percent: 5, room: 'Office' },
            { name: 'Lights', power: '0.08 kW', percent: 3, room: 'Various' },
            { name: 'TV', power: '0.05 kW', percent: 2, room: 'Living Room' },
          ].map((device) => (
            <div key={device.name} className="bg-surface-low rounded-ha-xl p-ha-3">
              <div className="flex items-center justify-between mb-ha-2">
                <div>
                  <span className="text-sm text-text-primary">{device.name}</span>
                  <span className="text-xs text-text-secondary ml-ha-2">{device.room}</span>
                </div>
                <span className="text-sm font-medium text-text-primary">{device.power}</span>
              </div>
              <div className="h-1.5 bg-surface-lower rounded-full overflow-hidden">
                <div
                  className="h-full bg-ha-blue rounded-full transition-all"
                  style={{ width: `${device.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-ha-3">
        <button className="bg-surface-low hover:bg-surface-default rounded-ha-xl p-ha-4 text-left transition-colors">
          <div className="text-sm font-medium text-text-primary mb-ha-1">Eco Mode</div>
          <div className="text-xs text-text-secondary">Reduce non-essential usage</div>
        </button>
        <button className="bg-surface-low hover:bg-surface-default rounded-ha-xl p-ha-4 text-left transition-colors">
          <div className="text-sm font-medium text-text-primary mb-ha-1">Battery Reserve</div>
          <div className="text-xs text-text-secondary">Set to 20% minimum</div>
        </button>
      </div>
    </div>
  );
}

function AllContent() {
  return (
    <div className="space-y-ha-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-ha-3">
        {[
          { label: 'Today', value: '12.4 kWh', cost: '$3.20', trend: '+8%', trendUp: true },
          { label: 'This Week', value: '78.2 kWh', cost: '$18.50', trend: '-5%', trendUp: false },
          { label: 'This Month', value: '342 kWh', cost: '$72.40', trend: '+3%', trendUp: true },
          { label: 'This Year', value: '2,847 kWh', cost: '$612', trend: '-12%', trendUp: false },
        ].map((item) => (
          <div key={item.label} className="bg-surface-low rounded-ha-xl p-ha-3">
            <div className="text-xs text-text-secondary mb-ha-1">{item.label}</div>
            <div className="text-xl font-semibold text-text-primary">{item.value}</div>
            <div className="flex items-center justify-between mt-ha-2">
              <span className="text-sm text-text-secondary">{item.cost}</span>
              <span className={`text-xs ${item.trendUp ? 'text-red-500' : 'text-green-500'}`}>
                {item.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Consumption vs Production */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-ha-3">
        <div className="bg-surface-low rounded-ha-xl p-ha-4">
          <div className="text-sm font-medium text-text-primary mb-ha-3">Consumption</div>
          <div className="space-y-ha-3">
            {[
              { time: 'Morning (6-12)', value: '3.2 kWh', percent: 26 },
              { time: 'Afternoon (12-18)', value: '4.8 kWh', percent: 39 },
              { time: 'Evening (18-24)', value: '3.6 kWh', percent: 29 },
              { time: 'Night (0-6)', value: '0.8 kWh', percent: 6 },
            ].map((period) => (
              <div key={period.time}>
                <div className="flex justify-between text-xs mb-ha-1">
                  <span className="text-text-secondary">{period.time}</span>
                  <span className="text-text-primary font-medium">{period.value}</span>
                </div>
                <div className="h-2 bg-surface-lower rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${period.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface-low rounded-ha-xl p-ha-4">
          <div className="text-sm font-medium text-text-primary mb-ha-3">Solar Production</div>
          <div className="space-y-ha-3">
            {[
              { time: 'Morning (6-12)', value: '2.8 kWh', percent: 35 },
              { time: 'Afternoon (12-18)', value: '4.2 kWh', percent: 52 },
              { time: 'Evening (18-24)', value: '1.0 kWh', percent: 13 },
              { time: 'Night (0-6)', value: '0 kWh', percent: 0 },
            ].map((period) => (
              <div key={period.time}>
                <div className="flex justify-between text-xs mb-ha-1">
                  <span className="text-text-secondary">{period.time}</span>
                  <span className="text-text-primary font-medium">{period.value}</span>
                </div>
                <div className="h-2 bg-surface-lower rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500 rounded-full"
                    style={{ width: `${period.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart placeholder */}
      <div className="bg-surface-low rounded-ha-xl p-ha-4">
        <div className="flex items-center justify-between mb-ha-3">
          <div className="text-sm font-medium text-text-primary">Usage History</div>
          <div className="flex gap-ha-2">
            {['Day', 'Week', 'Month', 'Year'].map((period) => (
              <button
                key={period}
                className="px-ha-2 py-ha-1 text-xs rounded-ha-lg bg-surface-lower text-text-secondary hover:text-text-primary transition-colors"
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        <div className="h-48 bg-surface-lower rounded-ha-lg flex items-end justify-around p-ha-4 gap-ha-1">
          {/* Simple bar chart visualization */}
          {[65, 45, 80, 55, 70, 40, 85, 60, 75, 50, 90, 45].map((height, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-ha-1">
              <div
                className="w-full bg-ha-blue rounded-t-sm transition-all"
                style={{ height: `${height}%` }}
              />
              <span className="text-[10px] text-text-disabled">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Energy Sources Breakdown */}
      <div className="bg-surface-low rounded-ha-xl p-ha-4">
        <div className="text-sm font-medium text-text-primary mb-ha-3">Energy Sources This Month</div>
        <div className="grid grid-cols-3 gap-ha-4 mb-ha-4">
          <div className="text-center">
            <div className="text-2xl font-semibold text-red-500">58%</div>
            <div className="text-xs text-text-secondary">Grid</div>
            <div className="text-xs text-text-secondary">198 kWh</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-yellow-500">35%</div>
            <div className="text-xs text-text-secondary">Solar</div>
            <div className="text-xs text-text-secondary">120 kWh</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-green-500">7%</div>
            <div className="text-xs text-text-secondary">Battery</div>
            <div className="text-xs text-text-secondary">24 kWh</div>
          </div>
        </div>
        <div className="h-3 bg-surface-lower rounded-full overflow-hidden flex">
          <div className="bg-red-500" style={{ width: '58%' }} />
          <div className="bg-yellow-500" style={{ width: '35%' }} />
          <div className="bg-green-500" style={{ width: '7%' }} />
        </div>
      </div>

      {/* Carbon Footprint */}
      <div className="bg-green-500/10 rounded-ha-xl p-ha-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-text-primary mb-ha-1">Carbon Footprint</div>
            <div className="text-2xl font-semibold text-green-600">142 kg CO2</div>
            <div className="text-xs text-text-secondary">This month</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-green-600 font-medium">-18% vs last month</div>
            <div className="text-xs text-text-secondary">48 kg saved with solar</div>
          </div>
        </div>
      </div>

      {/* All devices */}
      <div>
        <div className="flex items-center justify-between mb-ha-3">
          <div className="text-sm font-medium text-text-primary">Device Consumption</div>
          <button className="text-xs text-ha-blue">View all</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-ha-2">
          {[
            { name: 'Air Conditioner', today: '4.2 kWh', month: '126 kWh', cost: '$27.20', icon: '❄️' },
            { name: 'Water Heater', today: '3.1 kWh', month: '93 kWh', cost: '$20.10', icon: '🔥' },
            { name: 'Washing Machine', today: '2.1 kWh', month: '42 kWh', cost: '$9.10', icon: '🫧' },
            { name: 'Refrigerator', today: '1.8 kWh', month: '54 kWh', cost: '$11.70', icon: '🧊' },
            { name: 'Dishwasher', today: '1.5 kWh', month: '38 kWh', cost: '$8.20', icon: '🍽️' },
            { name: 'EV Charger', today: '0 kWh', month: '85 kWh', cost: '$18.40', icon: '🔌' },
            { name: 'Dryer', today: '0 kWh', month: '32 kWh', cost: '$6.90', icon: '👕' },
            { name: 'Lights', today: '0.8 kWh', month: '24 kWh', cost: '$5.20', icon: '💡' },
            { name: 'TV & Entertainment', today: '0.6 kWh', month: '18 kWh', cost: '$3.90', icon: '📺' },
            { name: 'Other', today: '1.2 kWh', month: '36 kWh', cost: '$7.80', icon: '🔋' },
          ].map((device) => (
            <div key={device.name} className="flex items-center gap-ha-3 bg-surface-low rounded-ha-xl p-ha-3">
              <span className="text-xl">{device.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary truncate">{device.name}</div>
                <div className="text-xs text-text-secondary">{device.today} today</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-text-primary">{device.month}</div>
                <div className="text-xs text-text-secondary">{device.cost}/mo</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-fill-primary-quiet rounded-ha-xl p-ha-4">
        <div className="text-sm font-medium text-text-primary mb-ha-2">Energy Saving Tips</div>
        <ul className="space-y-ha-2 text-sm text-text-secondary">
          <li className="flex gap-ha-2">
            <span className="text-ha-blue">•</span>
            Your AC usage is 15% higher than average. Consider raising the temperature by 1°C.
          </li>
          <li className="flex gap-ha-2">
            <span className="text-ha-blue">•</span>
            Running the dishwasher at night could save $4.20/month with off-peak rates.
          </li>
          <li className="flex gap-ha-2">
            <span className="text-ha-blue">•</span>
            Your solar panels produced 8% less this month. Schedule a cleaning check.
          </li>
        </ul>
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
            className="h-full overflow-y-auto overscroll-none touch-pan-y relative px-ha-3 py-ha-4 lg:pl-14 lg:pr-ha-5 lg:pt-ha-5 lg:pb-ha-5" 
            data-scrollable="dashboard"
          >

            {/* Tabs - sticky on mobile */}
            <div
              className="sticky top-0 -mx-ha-3 px-ha-3 lg:-ml-14 lg:pl-14 lg:-mr-ha-5 lg:pr-ha-5 pt-ha-1 pb-ha-3 z-10 backdrop-blur-md"
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
