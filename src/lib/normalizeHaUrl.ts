/**
 * Forgiving Home Assistant address input: people type "homeassistant.local:8123"
 * or paste with trailing slashes — normalize instead of bouncing them with a
 * browser validation bubble.
 */
export function normalizeHaUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return url;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  return url.replace(/\/+$/, '');
}
