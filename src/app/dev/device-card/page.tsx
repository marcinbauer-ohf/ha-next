'use client';

import {
  mdiPower,
  mdiSpeaker,
  mdiPrinter,
  mdiDesk,
  mdiFlash,
  mdiThermometer,
  mdiWaterPercent,
  mdiMotionSensor,
} from '@mdi/js';
import { DeviceCard } from '@/components/cards/DeviceCard';

const PRINTER_ATTRS = [
  { label: 'Black ink', value: '56 %' },
  { label: 'Yellow ink', value: '56 %' },
  { label: 'Magent ink', value: '56 %' },
  { label: 'Cyan ink', value: '56 %' },
];

const OUTLET_ATTRS = [
  { label: 'Voltage', value: '54 V' },
  { label: 'Current', value: '0.26 A' },
  { label: 'Energy', value: '12.3 kWh' },
  { label: 'Energy Tod...', value: '0.4 kWh' },
];

export default function DeviceCardPreview() {
  return (
    <div className="min-h-screen bg-surface-lower p-8">
      <h1 className="text-xl font-semibold text-text-primary mb-6">DeviceCard preview</h1>

      <div className="grid grid-cols-[280px_280px_280px] gap-6 items-start">

        {/* ── Column 1: Row variant ── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Row</p>

          <DeviceCard
            variant="row"
            icon={mdiDesk}
            name="Desk"
            state="Off"
          />

          <DeviceCard
            variant="row"
            dark
            icon={mdiDesk}
            name="Desk"
            state="Off"
          />

          <DeviceCard
            variant="row"
            icon={mdiSpeaker}
            name="Speaker"
            state="Playing"
            active
          />

          <DeviceCard
            variant="row"
            icon={mdiPrinter}
            name="Printer"
            state="Printing • 50%"
            active
            attributes={PRINTER_ATTRS}
          />

          <DeviceCard
            variant="row"
            dark
            icon={mdiPrinter}
            name="Printer"
            state="Printing • 50%"
            active
            attributes={PRINTER_ATTRS}
          />
        </div>

        {/* ── Column 2: Card variant ── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Card</p>

          <DeviceCard
            variant="card"
            icon={mdiSpeaker}
            name="Speaker"
            state="Off"
          />

          <DeviceCard
            variant="card"
            dark
            icon={mdiSpeaker}
            name="Speaker"
            state="Off"
          />

          <DeviceCard
            variant="card"
            icon={mdiFlash}
            name="Power outlet"
            state="On"
            active
            attributes={OUTLET_ATTRS}
          />

          <DeviceCard
            variant="card"
            dark
            icon={mdiFlash}
            name="Power outlet"
            state="On"
            active
            attributes={OUTLET_ATTRS}
          />
        </div>

        {/* ── Column 3: Multi-entity + controls ── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Multi-entity + Controls</p>

          <DeviceCard
            variant="card"
            entities={[
              { icon: mdiFlash, name: 'Power outlet 1', state: 'On', active: true, attributes: OUTLET_ATTRS },
              { icon: mdiFlash, name: 'Power outlet 2', state: 'Off', attributes: OUTLET_ATTRS },
            ]}
          />

          <DeviceCard
            variant="card"
            dark
            entities={[
              { icon: mdiFlash, name: 'Power outlet 1', state: 'On', active: true, attributes: OUTLET_ATTRS },
              { icon: mdiFlash, name: 'Power outlet 2', state: 'Off', attributes: OUTLET_ATTRS },
            ]}
          />

          <DeviceCard
            variant="card"
            icon={mdiFlash}
            name="Power outlet"
            state="On"
            active
            label="Label"
            showPower
            powerOn
            showToggle
            toggleOn
          />

          <DeviceCard
            variant="card"
            dark
            icon={mdiFlash}
            name="Power outlet"
            state="On"
            active
            label="Label"
            showPower
            powerOn={false}
            showToggle
            toggleOn={false}
          />
        </div>

      </div>
    </div>
  );
}
