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
import { FinaleStep } from '@/components/onboarding/steps/FinaleStep';
import { resetOnboarding } from '@/lib/onboarding';

/**
 * /dev/ bypasses AppShell, so the dashboard the finale reveals doesn't exist
 * here — this iframe stands in for it. Dev preview only.
 */
function AppBehind() {
  return (
    <iframe
      src="/"
      title="Dashboard behind the flow"
      aria-hidden
      tabIndex={-1}
      // Same handle the real shell carries, so the finale's dolly (globals.css)
      // moves this stand-in too — otherwise the preview can't show it.
      data-app-shell
      className="fixed inset-0 w-full h-full border-0 pointer-events-none"
    />
  );
}

export default function OnboardingPreviewPage() {
  const router = useRouter();
  const [runId, setRunId] = useState(0);
  const [finished, setFinished] = useState(false);
  // Iterating on the finale without replaying nine steps first.
  const [finaleOnly, setFinaleOnly] = useState(false);

  if (finaleOnly) {
    return (
      <div data-mode="dark" className="fixed inset-0 bg-surface-default text-text-primary">
        <AppBehind />
        <FinaleStep key={runId} onFinish={() => setRunId((n) => n + 1)} />
      </div>
    );
  }

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
            className="h-11 px-ha-5 rounded-full bg-ha-blue text-white text-sm font-semibold hover:brightness-110 transition-all"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={() => {
              resetOnboarding();
              router.push('/');
            }}
            className="h-11 px-ha-5 rounded-full bg-surface-low text-text-primary text-sm font-semibold hover:bg-surface-mid transition-colors"
          >
            Reset gate &amp; open app
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppBehind />
      <OnboardingFlow key={runId} resume={false} onDone={() => setFinished(true)} />
      <button
        type="button"
        onClick={() => setFinaleOnly(true)}
        className="fixed bottom-ha-3 left-ha-3 z-[200] h-8 px-ha-3 rounded-full bg-black/50 text-white/70 text-xs"
      >
        Replay the finale
      </button>
    </>
  );
}
