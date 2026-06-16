'use client';

/**
 * EXPERIMENT — /dev/onboarding
 *
 * Minimalistic, mobile-first setup wizard modelled on Home Assistant's initial
 * config flow, plus a floors & areas step. Lives under /dev/ so AppShell chrome
 * is bypassed. Finishes by opening the default dashboard at `/`.
 */

import { OnboardingWizard } from '@/components/onboarding';

export default function OnboardingPage() {
  return <OnboardingWizard />;
}
