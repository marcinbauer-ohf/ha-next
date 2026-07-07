import type { HassEntity } from '@/types';

export type SimulationType =
  | 'release'
  | 'media'
  | 'timer'
  | 'camera'
  | 'printer'
  | 'vacuum'
  | 'update_install'
  | 'backup_run'
  | 'alarm';

export const simulationPrefixes: Record<SimulationType, string> = {
  release: 'update.home_assistant_release_notes_simulated',
  media: 'media_player.simulated',
  timer: 'timer.simulated',
  camera: 'binary_sensor.camera_simulated',
  printer: 'sensor.printer_simulated',
  vacuum: 'vacuum.simulated',
  update_install: 'update.simulated_install',
  backup_run: 'backup.simulated_running',
  alarm: 'alarm_control_panel.simulated',
};

// Rooms a simulated vacuum reports cleaning. Also reused by the random-activation
// simulator so its cycles read like a real robot working through the house.
export const VACUUM_AREAS = ['Living Room', 'Kitchen', 'Hallway', 'Bedroom', 'Office', 'Dining Room'];

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
    case 'vacuum':
      return {
        entity_id: entityId,
        state: 'cleaning',
        attributes: {
          friendly_name: `Robot Vacuum${nameSuffix}`,
          progress: Math.floor(Math.random() * 100),
          current_area: VACUUM_AREAS[Math.floor(Math.random() * VACUUM_AREAS.length)],
          battery_level: 40 + Math.floor(Math.random() * 60),
          fan_speed: 'Balanced',
          time_remaining: '00:18:00',
        },
        last_changed: now,
        last_updated: now,
      };
    case 'update_install':
      return {
        entity_id: entityId,
        state: 'on',
        attributes: {
          friendly_name: `Home Assistant Core${nameSuffix}`,
          in_progress: true,
          update_percentage: 35 + Math.floor(Math.random() * 40),
          installed_version: '2026.1.0',
          latest_version: `2026.2.${releaseNumber}`,
        },
        last_changed: now,
        last_updated: now,
      };
    case 'backup_run':
      return {
        entity_id: entityId,
        state: 'in_progress',
        attributes: {
          friendly_name: `Backup${nameSuffix}`,
          progress: 20 + Math.floor(Math.random() * 60),
          stage: 'Uploading to Google Drive',
        },
        last_changed: now,
        last_updated: now,
      };
    case 'alarm':
      return {
        entity_id: entityId,
        state: 'arming',
        attributes: {
          friendly_name: `Home Alarm${nameSuffix}`,
        },
        last_changed: now,
        last_updated: now,
      };
  }
}
