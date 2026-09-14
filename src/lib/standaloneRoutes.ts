/**
 * Routes that own the whole screen.
 *
 * The `/dev/*` prototypes and `/spin` are not the app: they render without
 * AppShell's chrome, and nothing the shell does globally — toasts, keyboard
 * shortcuts, the screensaver, the system-update overlay — belongs on top of
 * them. One predicate so every guard agrees on what "standalone" means; the
 * leak they exist to stop is a shell effect firing on a prototype because one
 * check was written slightly differently.
 */
export function isStandaloneRoute(pathname: string): boolean {
  return pathname.startsWith('/dev/') || pathname.startsWith('/spin');
}
