'use client';

/**
 * DEV PREVIEW — /dev/onboarding
 *
 * The real first-run flow (OnboardingFlow) with a replay affordance instead of
 * the real gate: finishing shows a summary card with "Play again" / "Open
 * dashboard" rather than marking onboarding done. Lives under /dev/ so AppShell
 * chrome is bypassed.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingFlow } from '@/components/onboarding';
import { resetOnboarding } from '@/lib/onboarding';

export default function OnboardingPreviewPage() {
  const router = useRouter();
  const [runId, setRunId] = useState(0);
  const [finished, setFinished] = useState(false);

  if (finished) {
    return (
      <div className="h-[100svh] flex flex-col items-center justify-center gap-ha-4 bg-surface-default text-center px-ha-6">
        <p className="text-lg font-semibold text-text-primary">Flow finished</p>
        <p className="text-sm text-text-secondary max-w-sm">
          This preview doesn&apos;t mark onboarding as done. Use the buttons below — or clear the
          real gate to see it on the next fresh visit.
        </p>
        <div className="flex items-center gap-ha-2">
          <button
            type="button"
            onClick={() => {
              setFinished(false);
              setRunId((n) => n + 1);
            }}
            className="h-11 px-ha-5 rounded-ha-pill bg-ha-blue text-white text-sm font-semibold hover:brightness-110 transition-all"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={() => {
              resetOnboarding();
              router.push('/');
            }}
            className="h-11 px-ha-5 rounded-ha-pill bg-surface-low text-text-primary text-sm font-semibold hover:bg-surface-mid transition-colors"
          >
            Reset gate &amp; open app
          </button>
        </div>
      </div>
    );
  }

  return <OnboardingFlow key={runId} resume={false} onDone={() => setFinished(true)} />;
}
