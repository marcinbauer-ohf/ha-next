import type { HassEntities, HassEntity } from '@/types';

function createEntity(
  entityId: string,
  state: string,
  attributes: HassEntity['attributes'],
  timestamp: string
): HassEntity {
  return {
    entity_id: entityId,
    state,
    attributes,
    last_changed: timestamp,
    last_updated: timestamp,
  };
}

export function createDemoEntities(now = new Date()): HassEntities {
  const timestamp = now.toISOString();
  const finishesAt = new Date(now.getTime() + 25 * 60 * 1000).toISOString();

  return {
    'person.demo_user': createEntity(
      'person.demo_user',
      'home',
      {
        friendly_name: 'Demo User',
        entity_picture: '/casita.png',
      },
      timestamp
    ),
    'cloud.cloud': createEntity(
      'cloud.cloud',
      'connected',
      {
        friendly_name: 'Home Assistant Cloud',
      },
      timestamp
    ),
    'binary_sensor.remote_ui': createEntity(
      'binary_sensor.remote_ui',
      'on',
      {
        friendly_name: 'Remote UI',
      },
      timestamp
    ),
    'update.home_assistant_release_notes_simulated': createEntity(
      'update.home_assistant_release_notes_simulated',
      'on',
      {
        friendly_name: 'Home Assistant 2026.2.1',
        latest_version: '2026.2.1',
        release_summary: 'Dashboard polish and smoother mobile interactions.',
        release_notes: [
          'Improved activity widgets with clearer states.',
          'Faster transitions when opening panels.',
          'Refined spacing for cards on mobile.',
        ],
      },
      timestamp
    ),
    'media_player.simulated': createEntity(
      'media_player.simulated',
      'playing',
      {
        friendly_name: 'Living Room Speaker',
        media_title: 'Late Night Coding',
        media_artist: 'Demo Playlist',
        entity_picture: '/ha-logo-source.png',
      },
      timestamp
    ),
    'timer.simulated': createEntity(
      'timer.simulated',
      'active',
      {
        friendly_name: 'Laundry Timer',
        duration: '0:30:00',
        remaining: '0:25:00',
        finishes_at: finishesAt,
      },
      timestamp
    ),
    'binary_sensor.camera_simulated': createEntity(
      'binary_sensor.camera_simulated',
      'on',
      {
        friendly_name: 'Front Door Camera',
        event_type: 'Person detected',
        entity_picture: '/camera_doorbell.png',
      },
      timestamp
    ),
    'sensor.printer_simulated': createEntity(
      'sensor.printer_simulated',
      'printing',
      {
        friendly_name: 'Voron 2.4',
        progress: 63,
        file_name: 'case_mount.stl',
        time_remaining: '00:42:00',
        entity_picture: '/printer_3d.png',
      },
      timestamp
    ),
    'persistent_notification.demo_ready': createEntity(
      'persistent_notification.demo_ready',
      'notifying',
      {
        title: 'Demo mode enabled',
        friendly_name: 'Demo mode enabled',
        message: 'You are browsing with local demo entities.',
      },
      timestamp
    ),
  };
}
