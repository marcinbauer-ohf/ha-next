import type { Metadata } from 'next';

// Route-scoped manifest so "Add to Home Screen" launches back into the
// prototype instead of the root app (the global manifest's start_url is "/").
export const metadata: Metadata = {
  title: 'HA Onboarding',
  manifest: '/manifest-onboarding-v2.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Onboarding',
  },
};

export default function OnboardingV2Layout({ children }: { children: React.ReactNode }) {
  return children;
}
