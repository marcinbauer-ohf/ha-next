'use client';

import { useRouter } from 'next/navigation';
import { mdiDevices, mdiPlus } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { Button } from '../ui';
import { useAddContext } from '@/contexts';
import { useHomeAssistant } from '@/hooks';

/**
 * The dashboard with nothing on it — a fresh instance, before a single device.
 * The same shape as a summary's intro screen (one big glyph, what belongs here,
 * one way forward), because it's the same moment: nothing to read yet, so say
 * what this is for instead of leaving a page of grey text.
 *
 * Deliberately not a demo: no placeholder cards, no sample devices, nothing
 * that could be mistaken for the user's own home.
 */
export function EmptyDashboard() {
  const router = useRouter();
  const { requestAdd } = useAddContext();
  // The demo never opens a socket, so it reads as disconnected — but an emptied
  // demo home is a home you can add to, not a missing connection.
  const { connected, demoMode } = useHomeAssistant();
  const hasHome = connected || demoMode;

  // The same jump the top-bar "+" makes for "Device or service" — straight into the
  // brand store rather than a settings page you then have to find your way out of.
  const addDevice = () => {
    requestAdd('devices');
    router.push('/settings/devices');
  };

  return (
    // ponytail: a 76svh box centres this within ~a dozen px of the real content
    // area on both breakpoints. The dashboard scroller isn't a flex parent, so
    // there's no flex-1 to take; swap in an exact calc if the chrome changes.
    <div className="flex min-h-[76svh] w-full flex-col items-center justify-center gap-ha-4 px-ha-4 py-ha-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-low">
        <Icon path={mdiDevices} size={44} className="text-ha-blue" />
      </div>
      <div className="flex flex-col items-center gap-ha-2">
        {/* No full stop — display heading (see the house rule). */}
        <h2 className="text-2xl font-bold leading-tight text-text-primary">
          {hasHome ? 'Nothing here yet' : 'Your home, once it is connected'}
        </h2>
        <p className="max-w-sm text-sm text-text-secondary">
          {hasHome
            ? 'Add your first device and it lands on this dashboard — grouped by room, ready to drag where you want it.'
            : 'Connect your home and every light, lock and sensor in it shows up here.'}
        </p>
      </div>
      {hasHome && (
        <Button variant="primary" size="lg" icon={mdiPlus} onClick={addDevice}>
          Add your first device
        </Button>
      )}
    </div>
  );
}
