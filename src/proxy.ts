import { NextResponse, type NextRequest } from 'next/server';

/**
 * Second front door: any host that starts with `ha-onboarding` (e.g.
 * ha-onboarding.vercel.app, or a custom ha-onboarding.* domain added to the
 * same Vercel project) lands on the onboarding-v2 prototype. Every other host
 * is untouched.
 *
 * A redirect, not a rewrite: AppShell and the screensaver decide their /dev
 * bypass from usePathname(), which reports the BROWSER url — a rewrite would
 * leave it at "/" and mount the whole app chrome under the flow.
 */
export function proxy(req: NextRequest) {
  if (req.headers.get('host')?.startsWith('ha-onboarding')) {
    return NextResponse.redirect(new URL('/dev/onboarding-v2', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: '/' };
