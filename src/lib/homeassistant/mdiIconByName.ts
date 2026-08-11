// Entity icon overrides from the HA registry arrive as names ("mdi:washing-machine"),
// but every surface here draws SVG path data. A namespace import of @mdi/js would
// defeat tree-shaking, so the whole map is fetched once in its own lazy chunk;
// callers fall back to the domain icon until it lands (any later render — and
// entity ticks are constant — picks up the real icon).
let icons: Record<string, string> | null = null;
let loading = false;

function loadIcons(): void {
  if (loading) return;
  loading = true;
  import('@mdi/js')
    .then(m => { icons = m as unknown as Record<string, string>; })
    .catch(() => { loading = false; });
}

/** `mdi:washing-machine` → the mdiWashingMachine path, or null if unresolvable. */
export function mdiIconByName(name: unknown): string | null {
  if (typeof name !== 'string' || !name.startsWith('mdi:')) return null;
  if (!icons) {
    loadIcons();
    return null;
  }
  const key = 'mdi' + name.slice(4).replace(/(^|-)([a-z0-9])/g, (_m, _sep, c: string) => c.toUpperCase());
  const path = icons[key];
  return typeof path === 'string' ? path : null;
}
