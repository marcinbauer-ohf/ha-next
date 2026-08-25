'use client';

import { useEffect, useState } from 'react';
import { useHomeAssistant } from '@/hooks';
import { getPanels, type HaPanel } from '@/lib/homeassistant';

export default function SidebarDebugPage() {
  const { connected } = useHomeAssistant();
  const [panels, setPanels] = useState<Record<string, HaPanel> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) return;

    const fetchData = async () => {
      // Small delay to ensure connection is fully ready
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        console.log('Fetching panels...');
        const panelsData = await getPanels();
        console.log('Panels fetched:', panelsData);
        setPanels(panelsData);

        // Also log to console for easy copying
        console.log('=== PANELS ===');
        console.log(JSON.stringify(panelsData, null, 2));
      } catch (err) {
        console.error('Error fetching panels:', err);
        setError(`Panels: ${err}`);
      }
    };

    fetchData();
  }, [connected]);

  if (!connected) {
    return (
      <div className="p-8 bg-surface-default min-h-screen">
        <h1 className="text-2xl font-bold text-text-primary mb-4">Sidebar Debug</h1>
        <p className="text-text-secondary">Connecting to Home Assistant...</p>
      </div>
    );
  }

  if (error && !panels) {
    return (
      <div className="p-8 bg-surface-default min-h-screen">
        <h1 className="text-2xl font-bold text-text-primary mb-4">Sidebar Debug</h1>
        <p className="text-red-500 whitespace-pre-wrap">Error: {error}</p>
        <p className="text-text-secondary mt-4">Check the browser console for more details.</p>
      </div>
    );
  }

  // Separate lovelace dashboards from other panels
  const lovelaceDashboards = panels
    ? Object.entries(panels).filter(([, panel]) => panel.component_name === 'lovelace')
    : [];

  const otherPanels = panels
    ? Object.entries(panels).filter(([, panel]) => panel.title && panel.component_name !== 'lovelace')
    : [];

  return (
    <div className="p-8 bg-surface-default min-h-screen">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Sidebar Configuration</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text-primary mb-4">
          Lovelace Dashboards ({lovelaceDashboards.length})
        </h2>
        {lovelaceDashboards.length > 0 ? (
          <div className="bg-surface-low rounded-ha-lg p-4 space-y-3">
            {lovelaceDashboards.map(([key, panel]) => (
              <div key={key} className="flex items-center gap-3 p-3 bg-surface-default rounded-ha-md">
                <span className="text-lg font-mono text-text-secondary">{panel.icon || 'mdi:view-dashboard'}</span>
                <div>
                  <p className="font-medium text-text-primary">{panel.title || key}</p>
                  <p className="text-sm text-text-secondary">/{panel.url_path}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-secondary">No lovelace dashboards found or still loading...</p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text-primary mb-4">
          Other Panels ({otherPanels.length})
        </h2>
        {otherPanels.length > 0 ? (
          <div className="bg-surface-low rounded-ha-lg p-4 space-y-3">
            {otherPanels.map(([key, panel]) => (
              <div key={key} className="flex items-center gap-3 p-3 bg-surface-default rounded-ha-md">
                <span className="text-lg font-mono text-text-secondary">{panel.icon || 'mdi:cog'}</span>
                <div>
                  <p className="font-medium text-text-primary">{panel.title}</p>
                  <p className="text-sm text-text-secondary">
                    /{panel.url_path} • {panel.component_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-secondary">Loading panels...</p>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold text-text-primary mb-4">Raw Data (also logged to console)</h2>
        <details className="bg-surface-low rounded-ha-lg p-4">
          <summary className="cursor-pointer text-text-primary font-medium">All Panels JSON</summary>
          <pre className="mt-2 text-xs text-text-secondary overflow-auto max-h-96">
            {JSON.stringify(panels, null, 2)}
          </pre>
        </details>
      </section>
    </div>
  );
}
