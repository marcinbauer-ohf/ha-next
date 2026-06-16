// Tiny pub/sub bus for "reset the settings workspace to its default view".
// Tapping the settings entry point (StatusBar avatar) while already on the
// two-column /settings page can't reset via the router — the URL is unchanged
// and the active section lives in component state. The handler emits here and
// the workspace resets its active section back to Home Center. Module-level so
// the emitter (chrome) and subscriber (settings page) don't share a React tree.

type Listener = () => void;

const listeners = new Set<Listener>();

export function emitSettingsReset(): void {
  listeners.forEach((l) => l());
}

export function subscribeSettingsReset(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
