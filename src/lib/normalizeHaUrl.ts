/**
 * Forgiving Home Assistant address input: people type "homeassistant.local",
 * "homeassistant.local:8123", or paste with trailing slashes — normalize
 * instead of bouncing them with a browser validation bubble.
 *
 * Since HA 2026.8 new installs serve on port 80, so a portless address is the
 * normal case and "no port" no longer implies plain http — `ha.example.com`
 * or `abc123.ui.nabu.casa` are almost always TLS, while `homeassistant.local`
 * is not. So guess the scheme from the host instead of always assuming http.
 * An explicit scheme in the input always wins.
 */

/** localhost, single-label names, LAN suffixes, IPv4 and bracketed IPv6 literals. */
const LAN_HOST = /^(localhost|[^.]+|.*\.(local|lan|internal|home|home\.arpa)|\d{1,3}(\.\d{1,3}){3}|\[.*\])$/i;

/**
 * http or https for an address the user typed without one.
 * Explicit port wins (only :443 means TLS), otherwise LAN-ish hosts are http.
 */
function guessScheme(input: string): 'http' | 'https' {
  const authority = input.split('/')[0];
  const port = /:(\d+)$/.exec(authority)?.[1];
  // ponytail: a non-443 port always reads as http — someone serving TLS on
  // :8123 must type https:// themselves. Sniff both schemes if that shows up.
  if (port) return port === '443' ? 'https' : 'http';
  return LAN_HOST.test(authority) ? 'http' : 'https';
}

export function normalizeHaUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return url;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    url = `${guessScheme(url)}://${url}`;
  }
  return url.replace(/\/+$/, '');
}
