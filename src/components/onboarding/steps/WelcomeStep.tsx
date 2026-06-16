'use client';

import { Icon, HALogo } from '@/components/ui';
import { mdiCheckCircle } from '@mdi/js';
import type { StepProps } from '../types';

const POINTS = [
  'Connect your instance — or explore with demo data',
  'Name your home and pick units',
  'Set up floors and areas',
  'Drop your devices into rooms',
];

export function WelcomeStep(_props: StepProps) {
  return (
    <div className="flex flex-col items-center text-center gap-ha-5 pt-ha-6">
      <HALogo size={56} />
      <div className="space-y-ha-2">
        <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s set up your home</h1>
        <p className="text-text-secondary text-sm leading-relaxed">
          A few quick steps to get your dashboard ready. You can skip anything and
          change it later.
        </p>
      </div>

      <ul className="w-full mt-ha-2 space-y-ha-3 text-left">
        {POINTS.map(p => (
          <li key={p} className="flex items-start gap-ha-3">
            <Icon path={mdiCheckCircle} size={20} className="text-ha-blue mt-px shrink-0" />
            <span className="text-sm text-text-primary">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
