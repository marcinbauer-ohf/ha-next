/**
 * Translate raw connection-layer errors into plain, recoverable language for
 * non-technical users. Shared by the onboarding connect step and SetupScreen.
 */
export function friendlyConnectionError(raw: string | null | undefined): string {
  const msg = (raw ?? '').toLowerCase();
  if (msg.includes('auth') || msg.includes('token')) {
    return 'That access key doesn’t seem right. Double-check you copied the whole thing, then try again.';
  }
  if (msg.includes('url') || msg.includes('connect') || msg.includes('network') || msg.includes('fetch')) {
    return 'We couldn’t find your home at that address. Check it’s the same address you use in your browser.';
  }
  return 'Something went wrong while connecting. Give it another try in a moment.';
}
