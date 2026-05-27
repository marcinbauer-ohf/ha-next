import type { HassEntity } from '@/types';

export type SimulationType = 'release' | 'media' | 'timer' | 'camera' | 'printer';

export const simulationPrefixes: Record<SimulationType, string> = {
  release: 'update.home_assistant_release_notes_simulated',
  media: 'media_player.simulated',
  timer: 'timer.simulated',
  camera: 'binary_sensor.camera_simulated',
  printer: 'sensor.printer_simulated',
};

export function createSimulatedActivityEntity(type: SimulationType, entityId: string): HassEntity {
  const now = new Date().toISOString();
  const nextHalfHour = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const suffix = entityId.split('_').pop();
  const hasNumericSuffix = suffix !== undefined && !Number.isNaN(Number(suffix));
  const nameSuffix = hasNumericSuffix ? ` ${suffix}` : '';
  const releaseNumber = hasNumericSuffix ? Number(suffix) : 1;

  switch (type) {
    case 'release':
      return {
        entity_id: entityId,
        state: 'on',
        attributes: {
          friendly_name: `Home Assistant 2026.2.${releaseNumber}`,
          latest_version: `2026.2.${releaseNumber}`,
          release_summary: 'Dashboard polish, clearer state labels, and faster mobile navigation.',
          release_notes: [
            'New mobile bottom-sheet behavior keeps active widgets easy to reach.',
            'Task bar activities now support richer simulated states and previews.',
            'Visual refinements improve card readability on light and dark themes.',
            'Performance updates reduce animation jank while switching widgets.',
          ],
        },
        last_changed: now,
        last_updated: now,
      };
    case 'media':
      return {
        entity_id: entityId,
        state: 'playing',
        attributes: {
          friendly_name: `Simulated Player${nameSuffix}`,
          entity_picture: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop',
          media_title: 'Simulation Song',
          media_artist: 'The Mockers',
        },
        last_changed: now,
        last_updated: now,
      };
    case 'timer':
      return {
        entity_id: entityId,
        state: 'active',
        attributes: {
          friendly_name: `Simulated Timer${nameSuffix}`,
          duration: '0:10:00',
          remaining: '0:05:00',
          finishes_at: nextHalfHour,
        },
        last_changed: now,
        last_updated: now,
      };
    case 'camera':
      return {
        entity_id: entityId,
        state: 'on',
        attributes: {
          friendly_name: `Front Door Camera${nameSuffix}`,
          device_class: 'motion',
          event_type: 'Person detected',
        },
        last_changed: now,
        last_updated: now,
      };
    case 'printer':
      return {
        entity_id: entityId,
        state: 'printing',
        attributes: {
          friendly_name: `Voron 2.4${nameSuffix}`,
          progress: Math.floor(Math.random() * 100),
          file_name: 'test_print.stl',
          time_remaining: '00:45:00',
        },
        last_changed: now,
        last_updated: now,
      };
  }
}
