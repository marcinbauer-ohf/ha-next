import type { HassEntities, HassEntity } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Benchmark Rig — one synthetic device carrying every display permutation the
// more-info dialog has to handle, so the device card and EntityDetailPanel can
// be checked side by side against what each entity *should* show.
//
// Three kinds:
//   read    — no interaction at all (value / timeline / unavailable states)
//   control — on/off (or press) and nothing more
//   set     — a value surface beyond the toggle (slider, setpoint, transport)
//
// `note` is the expectation, not what the code does today: entries whose
// surface is missing are the findings this rig exists to surface.
// Staged only on /dev/entity-matrix — never merged into the real dashboard.
// ─────────────────────────────────────────────────────────────────────────────

export type BenchmarkKind = 'read' | 'control' | 'set';

export interface BenchmarkEntry {
  entity: HassEntity;
  kind: BenchmarkKind;
  /** What the panel is supposed to render for this entity. */
  note: string;
}

const DEVICE_NAME = 'Benchmark Rig';

function make(
  entityId: string,
  state: string,
  attributes: HassEntity['attributes'],
  agoMinutes = 12,
): HassEntity {
  const ts = new Date(Date.now() - agoMinutes * 60_000).toISOString();
  return { entity_id: entityId, state, attributes, last_changed: ts, last_updated: ts };
}

export function createBenchmarkEntries(): BenchmarkEntry[] {
  const nowIso = new Date().toISOString();
  const hourAgoIso = new Date(Date.now() - 3_600_000).toISOString();

  return [
    // ── read-only ────────────────────────────────────────────────────────
    {
      kind: 'read',
      note: 'Card: hero sparkline + hover scrub. Dialog: big value + unit, line chart, NOW label',
      entity: make('sensor.benchmark_temperature', '21.4', {
        friendly_name: `${DEVICE_NAME} Temperature`,
        device_class: 'temperature',
        state_class: 'measurement',
        unit_of_measurement: '°C',
      }),
    },
    {
      kind: 'read',
      note: 'Card: sparkline. Dialog: 7d/30d spans come from statistics, no min/max band',
      entity: make('sensor.benchmark_energy_today', '4.271', {
        friendly_name: `${DEVICE_NAME} Energy Today`,
        device_class: 'energy',
        state_class: 'total_increasing',
        unit_of_measurement: 'kWh',
      }),
    },
    {
      kind: 'read',
      note: 'Enum text state — capitalised; timeline in the dialog, no sparkline on the card',
      entity: make('sensor.benchmark_status', 'washing', {
        friendly_name: `${DEVICE_NAME} Status`,
        device_class: 'enum',
        options: ['idle', 'washing', 'rinsing', 'spinning', 'done'],
      }),
    },
    {
      kind: 'read',
      note: 'Timestamp device_class — should read as a time, not a raw ISO string',
      entity: make('sensor.benchmark_last_seen', hourAgoIso, {
        friendly_name: `${DEVICE_NAME} Last Seen`,
        device_class: 'timestamp',
      }),
    },
    {
      kind: 'read',
      note: 'Long text state — must truncate in card + panel, never overflow',
      entity: make('sensor.benchmark_firmware', '2026.7.1-beta.3 (build 41f9c2, channel edge)', {
        friendly_name: `${DEVICE_NAME} Firmware`,
      }),
    },
    {
      kind: 'read',
      note: 'Unavailable — amber state, controls and history suppressed',
      entity: make('sensor.benchmark_offline_probe', 'unavailable', {
        friendly_name: `${DEVICE_NAME} Offline Probe`,
        unit_of_measurement: 'ppm',
      }, 2880),
    },
    {
      kind: 'read',
      note: 'Unknown — same suppression as unavailable, different label',
      entity: make('sensor.benchmark_uncalibrated', 'unknown', {
        friendly_name: `${DEVICE_NAME} Uncalibrated`,
      }, 600),
    },
    {
      kind: 'read',
      note: 'Binary sensor — on/off timeline, NO toggle (read-only by domain)',
      entity: make('binary_sensor.benchmark_motion', 'on', {
        friendly_name: `${DEVICE_NAME} Motion`,
        device_class: 'motion',
      }, 3),
    },
    {
      kind: 'read',
      note: 'Diagnostic + negative numeric — signed value and its card sparkline render correctly',
      entity: make('sensor.benchmark_signal', '-63', {
        friendly_name: `${DEVICE_NAME} Signal`,
        device_class: 'signal_strength',
        state_class: 'measurement',
        unit_of_measurement: 'dBm',
        entity_category: 'diagnostic',
      }),
    },
    {
      kind: 'read',
      note: 'Battery sensor — kept off the dashboard card, still shown in the panel',
      entity: make('sensor.benchmark_battery', '87', {
        friendly_name: `${DEVICE_NAME} Battery`,
        device_class: 'battery',
        state_class: 'measurement',
        unit_of_measurement: '%',
      }),
    },
    {
      kind: 'read',
      note: 'Event entity — state is the last fire time, event_type is the payload',
      entity: make('event.benchmark_remote', nowIso, {
        friendly_name: `${DEVICE_NAME} Remote`,
        event_type: 'button_2_double_press',
        event_types: ['button_1_press', 'button_2_double_press', 'button_3_hold'],
      }, 0),
    },

    // ── read-only: value formatting ──────────────────────────────────────
    {
      kind: 'read',
      note: 'suggested_display_precision — must round to 1 decimal, not print 21.4000001',
      entity: make('sensor.benchmark_precision', '21.400000001', {
        friendly_name: `${DEVICE_NAME} Precise Temperature`,
        device_class: 'temperature',
        state_class: 'measurement',
        unit_of_measurement: '°C',
        suggested_display_precision: 1,
      }),
    },
    {
      kind: 'read',
      note: 'Duration device_class — reads as words (1 h 12 min), unit not glued on',
      entity: make('sensor.benchmark_runtime', '4320', {
        friendly_name: `${DEVICE_NAME} Runtime`,
        device_class: 'duration',
        state_class: 'measurement',
        unit_of_measurement: 's',
      }),
    },
    {
      kind: 'read',
      note: 'Monetary — currency code as the unit',
      entity: make('sensor.benchmark_cost_today', '4.28', {
        friendly_name: `${DEVICE_NAME} Cost Today`,
        device_class: 'monetary',
        state_class: 'total',
        unit_of_measurement: 'EUR',
        suggested_display_precision: 2,
      }),
    },
    {
      kind: 'read',
      note: 'Data size — large numbers keep their unit and precision',
      entity: make('sensor.benchmark_storage', '1843.7', {
        friendly_name: `${DEVICE_NAME} Storage Used`,
        device_class: 'data_size',
        state_class: 'measurement',
        unit_of_measurement: 'MB',
        suggested_display_precision: 0,
      }),
    },
    {
      kind: 'read',
      note: 'Attribution row in settings; numeric with NO unit still earns a card sparkline',
      entity: make('sensor.benchmark_pollen', '3.4', {
        friendly_name: `${DEVICE_NAME} Pollen Index`,
        state_class: 'measurement',
        attribution: 'Data provided by the Open Home Foundation weather service',
      }),
    },
    {
      kind: 'read',
      note: 'Rich extra attributes — ink levels belong in the attributes list',
      entity: make('sensor.benchmark_printer', 'ready', {
        friendly_name: `${DEVICE_NAME} Printer`,
        black_ink: 56,
        cyan_ink: 41,
        magenta_ink: 38,
        yellow_ink: 12,
        pages_printed: 8421,
        tray_status: 'loaded',
      }),
    },
    {
      kind: 'read',
      note: 'Custom icon attribute (mdi:washing-machine) must beat the domain icon',
      entity: make('sensor.benchmark_custom_icon', 'spinning', {
        friendly_name: `${DEVICE_NAME} Drum`,
        icon: 'mdi:washing-machine',
      }),
    },
    {
      kind: 'read',
      note: 'No friendly_name — falls back to a readable id, never a blank row',
      entity: make('sensor.benchmark_unnamed', '7', {
        state_class: 'measurement',
        unit_of_measurement: 'x',
      }),
    },
    {
      kind: 'read',
      note: 'Non-latin + long name — truncation and font fallback',
      entity: make('sensor.benchmark_intl', '18.9', {
        friendly_name: 'Køkken temperatur · 온도 센서 · датчик температуры',
        device_class: 'temperature',
        unit_of_measurement: '°C',
      }),
    },
    {
      kind: 'read',
      note: 'Config-category helper — not a diagnostic, still not a control',
      entity: make('sensor.benchmark_config_slot', 'slot_b', {
        friendly_name: `${DEVICE_NAME} Config Slot`,
        entity_category: 'config',
      }),
    },

    // ── read-only: binary_sensor wording per device_class ─────────────────
    {
      kind: 'read',
      note: 'Door class — Open / Closed, never On / Off',
      entity: make('binary_sensor.benchmark_door', 'on', {
        friendly_name: `${DEVICE_NAME} Door`,
        device_class: 'door',
      }, 8),
    },
    {
      kind: 'read',
      note: 'Moisture class — Wet / Dry',
      entity: make('binary_sensor.benchmark_leak', 'off', {
        friendly_name: `${DEVICE_NAME} Leak`,
        device_class: 'moisture',
      }, 400),
    },
    {
      kind: 'read',
      note: 'Connectivity class — Connected / Disconnected',
      entity: make('binary_sensor.benchmark_link', 'on', {
        friendly_name: `${DEVICE_NAME} Link`,
        device_class: 'connectivity',
        entity_category: 'diagnostic',
      }),
    },
    {
      kind: 'read',
      note: 'Battery charging class — Charging / Not charging',
      entity: make('binary_sensor.benchmark_charging', 'on', {
        friendly_name: `${DEVICE_NAME} Charging`,
        device_class: 'battery_charging',
        entity_category: 'diagnostic',
      }, 30),
    },
    {
      kind: 'read',
      note: 'Problem class — Problem / OK',
      entity: make('binary_sensor.benchmark_problem', 'off', {
        friendly_name: `${DEVICE_NAME} Fault`,
        device_class: 'problem',
        entity_category: 'diagnostic',
      }, 1200),
    },

    // ── control (on/off or press, nothing to set) ────────────────────────
    {
      kind: 'control',
      note: 'Toggle + power draw in the card corner badge',
      entity: make('switch.benchmark_outlet', 'on', {
        friendly_name: `${DEVICE_NAME} Outlet`,
        device_class: 'outlet',
        current_power_w: 42.6,
      }),
    },
    {
      kind: 'control',
      note: 'Helper toggle — same treatment as a hardware switch',
      entity: make('input_boolean.benchmark_guest_mode', 'off', {
        friendly_name: 'Guest mode',
      }),
    },
    {
      kind: 'set',
      note: 'Lock — lock/unlock, latch release (open), code field',
      entity: make('lock.benchmark_lock', 'locked', {
        friendly_name: `${DEVICE_NAME} Lock`,
        supported_features: 1,
        code_format: '[0-9]{4}',
      }),
    },
    {
      kind: 'set',
      note: 'Siren — toggle plus a tone picker',
      entity: make('siren.benchmark_siren', 'off', {
        friendly_name: `${DEVICE_NAME} Siren`,
        available_tones: ['chime', 'alarm', 'doorbell'],
      }),
    },
    {
      kind: 'control',
      note: 'assumed_state — HA splits these into explicit on/off buttons (no true state)',
      entity: make('switch.benchmark_rf_relay', 'off', {
        friendly_name: `${DEVICE_NAME} RF Relay`,
        assumed_state: true,
      }, 700),
    },
    {
      kind: 'control',
      note: 'Press-only — action button, state is the last press time',
      entity: make('button.benchmark_identify', hourAgoIso, {
        friendly_name: `${DEVICE_NAME} Identify`,
      }),
    },
    {
      kind: 'control',
      note: 'Script — press-only, shows running/idle',
      entity: make('script.benchmark_selftest', 'off', {
        friendly_name: `${DEVICE_NAME} Self Test`,
        last_triggered: hourAgoIso,
      }),
    },
    {
      kind: 'control',
      note: 'Scene — press-only action button, state is the last activation time',
      entity: make('scene.benchmark_showroom', hourAgoIso, {
        friendly_name: `${DEVICE_NAME} Showroom`,
      }),
    },

    // ── set (a value surface beyond the toggle) ──────────────────────────
    {
      kind: 'set',
      note: 'On/off-only light — toggle, no brightness slider',
      entity: make('light.benchmark_light_onoff', 'on', {
        friendly_name: `${DEVICE_NAME} Light (on/off)`,
        supported_color_modes: ['onoff'],
        color_mode: 'onoff',
      }),
    },
    {
      kind: 'set',
      note: 'Dimmable — brightness slider only, corner badge shows %',
      entity: make('light.benchmark_light_dimmable', 'on', {
        friendly_name: `${DEVICE_NAME} Light (dimmable)`,
        supported_color_modes: ['brightness'],
        color_mode: 'brightness',
        brightness: 178,
      }),
    },
    {
      kind: 'set',
      note: 'Tunable white — brightness + warm/cool kelvin slider',
      entity: make('light.benchmark_light_temp', 'on', {
        friendly_name: `${DEVICE_NAME} Light (tunable)`,
        supported_color_modes: ['color_temp'],
        color_mode: 'color_temp',
        brightness: 204,
        color_temp_kelvin: 3200,
        min_color_temp_kelvin: 2202,
        max_color_temp_kelvin: 6535,
      }),
    },
    {
      kind: 'set',
      note: 'Full colour — brightness + kelvin + swatches + white mode + effect list',
      entity: make('light.benchmark_light_rgb', 'on', {
        friendly_name: `${DEVICE_NAME} Light (colour)`,
        supported_color_modes: ['color_temp', 'rgb', 'white'],
        color_mode: 'rgb',
        brightness: 230,
        rgb_color: [33, 150, 243],
        color_temp_kelvin: 4000,
        min_color_temp_kelvin: 2000,
        max_color_temp_kelvin: 6500,
        effect_list: ['None', 'Candle', 'Fireplace', 'Colorloop', 'Sunrise'],
        effect: 'None',
      }),
    },
    {
      kind: 'set',
      note: 'Off dimmable light — slider at 0%, brightness attribute absent',
      entity: make('light.benchmark_light_off', 'off', {
        friendly_name: `${DEVICE_NAME} Light (off)`,
        supported_color_modes: ['brightness'],
      }, 240),
    },
    {
      kind: 'set',
      note: 'Setpoint ± with current temp underneath, HVAC pills, preset/fan/swing, humidity',
      entity: make('climate.benchmark_thermostat', 'heat', {
        friendly_name: `${DEVICE_NAME} Thermostat`,
        temperature: 21.5,
        current_temperature: 20.3,
        current_humidity: 44,
        humidity: 45,
        min_humidity: 30,
        max_humidity: 70,
        min_temp: 7,
        max_temp: 35,
        target_temp_step: 0.5,
        hvac_modes: ['off', 'heat', 'cool', 'heat_cool', 'auto'],
        hvac_action: 'heating',
        preset_modes: ['none', 'eco', 'boost', 'sleep', 'away'],
        preset_mode: 'eco',
        fan_modes: ['low', 'medium', 'high'],
        fan_mode: 'low',
        swing_modes: ['off', 'vertical'],
        swing_mode: 'off',
      }),
    },
    {
      kind: 'set',
      note: 'heat_cool range — two setpoints (heat to / cool to), not one',
      entity: make('climate.benchmark_heat_cool', 'heat_cool', {
        friendly_name: `${DEVICE_NAME} Dual Thermostat`,
        target_temp_low: 19.5,
        target_temp_high: 24,
        current_temperature: 22.1,
        min_temp: 7,
        max_temp: 35,
        target_temp_step: 0.5,
        hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
        hvac_action: 'idle',
      }),
    },
    {
      kind: 'set',
      note: 'Cover with position + tilt — travel row, position slider, tilt row + slider',
      entity: make('cover.benchmark_blind', 'open', {
        friendly_name: `${DEVICE_NAME} Blind`,
        device_class: 'blind',
        current_position: 60,
        current_tilt_position: 35,
        supported_features: 255,
      }),
    },
    {
      kind: 'set',
      note: 'Cover without position — travel buttons only, no slider',
      entity: make('cover.benchmark_gate', 'closed', {
        friendly_name: `${DEVICE_NAME} Gate`,
        device_class: 'gate',
        supported_features: 11,
      }, 90),
    },
    {
      kind: 'set',
      note: 'Fan — 33%-step slider, preset pills, oscillate + direction toggles',
      entity: make('fan.benchmark_fan', 'on', {
        friendly_name: `${DEVICE_NAME} Fan`,
        percentage: 66,
        percentage_step: 33,
        preset_modes: ['auto', 'sleep', 'turbo'],
        preset_mode: 'auto',
        oscillating: true,
        direction: 'forward',
      }),
    },
    {
      kind: 'set',
      note: 'Media — title/artist, transport, volume+mute, seek bar, shuffle/repeat, source',
      entity: make('media_player.benchmark_speaker', 'playing', {
        friendly_name: `${DEVICE_NAME} Speaker`,
        volume_level: 0.35,
        is_volume_muted: false,
        media_title: 'Rushmore Falls',
        media_artist: 'The Long Winters',
        media_duration: 214,
        media_position: 87,
        shuffle: false,
        repeat: 'off',
        source: 'Spotify',
        source_list: ['Spotify', 'Line in', 'TV', 'AirPlay', 'Radio'],
        sound_mode: 'Music',
        sound_mode_list: ['Music', 'Movie', 'Night'],
        entity_picture: '/devices/speaker.png',
      }, 1),
    },
    {
      kind: 'set',
      note: 'Camera — feed image on top, state below it, no toggle',
      entity: make('camera.benchmark_camera', 'streaming', {
        friendly_name: `${DEVICE_NAME} Camera`,
        entity_picture: '/devices/camera_dome.png',
      }, 1),
    },
    {
      kind: 'set',
      note: 'Number (slider mode) — min/max/step slider with the unit in the readout',
      entity: make('number.benchmark_target', '42', {
        friendly_name: `${DEVICE_NAME} Target`,
        min: 0,
        max: 100,
        step: 1,
        mode: 'slider',
        unit_of_measurement: '%',
      }),
    },
    {
      kind: 'set',
      note: 'Number (box mode) — exact entry, so ± around a value cell instead of a drag',
      entity: make('number.benchmark_offset', '-1.5', {
        friendly_name: `${DEVICE_NAME} Calibration Offset`,
        min: -5,
        max: 5,
        step: 0.5,
        mode: 'box',
        unit_of_measurement: '°C',
      }),
    },
    {
      kind: 'set',
      note: 'Select (4 options) — option pills, current one pressed',
      entity: make('select.benchmark_mode', 'eco', {
        friendly_name: `${DEVICE_NAME} Mode`,
        options: ['eco', 'balanced', 'boost', 'silent'],
      }),
    },
    {
      kind: 'set',
      note: 'Select (many options) — collapses into the dropdown instead of a pill wall',
      entity: make('input_select.benchmark_scene_pick', 'Evening', {
        friendly_name: 'Scene picker',
        options: ['Morning', 'Day', 'Evening', 'Night', 'Away', 'Party', 'Cinema'],
      }),
    },
    {
      kind: 'set',
      note: 'Text helper — field with a commit action, not a call per keystroke',
      entity: make('input_text.benchmark_label', 'Rack 3 / shelf B', {
        friendly_name: 'Rig label',
        min: 0,
        max: 255,
        mode: 'text',
      }),
    },
    {
      kind: 'set',
      note: 'Text entity with a pattern — same field, validated input',
      entity: make('text.benchmark_serial', 'OHF-4821', {
        friendly_name: `${DEVICE_NAME} Serial`,
        pattern: '[A-Z]{3}-[0-9]{4}',
        min: 8,
        max: 8,
        mode: 'text',
      }),
    },
    {
      kind: 'set',
      note: 'Date entity — native date picker',
      entity: make('date.benchmark_service_due', '2026-09-01', {
        friendly_name: `${DEVICE_NAME} Service Due`,
      }, 1440),
    },
    {
      kind: 'set',
      note: 'Time entity — native time picker',
      entity: make('time.benchmark_quiet_from', '22:30:00', {
        friendly_name: `${DEVICE_NAME} Quiet From`,
      }, 1440),
    },
    {
      kind: 'set',
      note: 'Datetime helper (date + time) — one datetime-local picker',
      entity: make('input_datetime.benchmark_next_run', '2026-08-12 06:30:00', {
        friendly_name: 'Next run',
        has_date: true,
        has_time: true,
      }, 60),
    },
    {
      kind: 'set',
      note: 'Vacuum — start/pause, dock, locate, suction pills, battery row',
      entity: make('vacuum.benchmark_vacuum', 'docked', {
        friendly_name: `${DEVICE_NAME} Vacuum`,
        battery_level: 92,
        fan_speed: 'medium',
        fan_speed_list: ['quiet', 'medium', 'turbo'],
      }, 45),
    },
    {
      kind: 'set',
      note: 'Lawn mower — start/pause + dock, nothing else to set',
      entity: make('lawn_mower.benchmark_mower', 'docked', {
        friendly_name: `${DEVICE_NAME} Mower`,
      }, 600),
    },
    {
      kind: 'set',
      note: 'Humidifier — target-humidity slider, current reading, mode pills',
      entity: make('humidifier.benchmark_humidifier', 'on', {
        friendly_name: `${DEVICE_NAME} Humidifier`,
        humidity: 45,
        current_humidity: 39,
        min_humidity: 30,
        max_humidity: 70,
        mode: 'auto',
        available_modes: ['auto', 'baby', 'eco'],
      }),
    },
    {
      kind: 'set',
      note: 'Water heater — temperature ±, operation modes, away toggle',
      entity: make('water_heater.benchmark_boiler', 'heat_pump', {
        friendly_name: `${DEVICE_NAME} Boiler`,
        temperature: 52,
        current_temperature: 49,
        min_temp: 35,
        max_temp: 75,
        operation_mode: 'heat_pump',
        operation_list: ['off', 'eco', 'heat_pump', 'high_demand'],
        away_mode: 'off',
      }, 120),
    },
    {
      kind: 'set',
      note: 'Valve with position — open/stop/close + position slider',
      entity: make('valve.benchmark_water_valve', 'open', {
        friendly_name: `${DEVICE_NAME} Water Valve`,
        device_class: 'water',
        current_valve_position: 80,
        supported_features: 15,
      }, 200),
    },
    {
      kind: 'set',
      note: 'Alarm panel — arm home/away/night pills, disarm, code field',
      entity: make('alarm_control_panel.benchmark_alarm', 'armed_home', {
        friendly_name: `${DEVICE_NAME} Alarm`,
        code_format: 'number',
        supported_features: 63,
      }, 300),
    },
    {
      kind: 'set',
      note: 'Remote — activity picker (dropdown, 5+ activities)',
      entity: make('remote.benchmark_remote_hub', 'on', {
        friendly_name: `${DEVICE_NAME} Remote Hub`,
        current_activity: 'Watch TV',
        activity_list: ['Watch TV', 'Play music', 'Gaming', 'Movie night', 'Off'],
      }, 20),
    },
    {
      kind: 'set',
      note: 'Timer — start/pause, cancel, finish + remaining time',
      entity: make('timer.benchmark_timer', 'active', {
        friendly_name: 'Laundry timer',
        duration: '0:45:00',
        remaining: '0:12:34',
      }, 33),
    },
    {
      kind: 'set',
      note: 'Counter — ± around the value with a reset underneath',
      entity: make('counter.benchmark_cycles', '318', {
        friendly_name: 'Wash cycles',
        step: 1,
        minimum: 0,
      }),
    },
    {
      kind: 'set',
      note: 'To-do list — add-item field (ticking items off needs the todo websocket API)',
      entity: make('todo.benchmark_shopping', '4', {
        friendly_name: 'Shopping list',
        supported_features: 15,
      }, 90),
    },
    {
      kind: 'set',
      note: 'Update — install/skip, progress bar, versions, release notes link',
      entity: make('update.benchmark_firmware', 'on', {
        friendly_name: `${DEVICE_NAME} Firmware Update`,
        installed_version: '2026.7.1',
        latest_version: '2026.8.0',
        update_percentage: 35,
        release_url: 'https://www.home-assistant.io/latest-release-notes/',
        title: 'Benchmark Rig firmware',
      }, 15),
    },
    {
      kind: 'read',
      note: 'Weather — current conditions + forecast rows, no controls',
      entity: make('weather.benchmark_forecast', 'partlycloudy', {
        friendly_name: 'Test Lab weather',
        temperature: 19,
        temperature_unit: '°C',
        humidity: 62,
        wind_speed: 11,
        wind_speed_unit: 'km/h',
        forecast: [
          { datetime: new Date(Date.now() + 86400000).toISOString(), temperature: 21, templow: 12, condition: 'sunny' },
          { datetime: new Date(Date.now() + 172800000).toISOString(), temperature: 18, templow: 11, condition: 'rainy' },
          { datetime: new Date(Date.now() + 259200000).toISOString(), temperature: 16, templow: 9, condition: 'cloudy' },
        ],
      }, 20),
    },
    {
      kind: 'read',
      note: 'Person — zone, source, battery, accuracy rows (never raw state === home)',
      entity: make('person.benchmark_tester', 'home', {
        friendly_name: 'Rig tester',
        source_type: 'gps',
        battery_level: 74,
        gps_accuracy: 12,
        in_zones: ['home'],
        entity_picture: '/dock-avatar.png',
      }, 25),
    },
    {
      kind: 'read',
      note: 'Calendar — next event with start/end/location',
      entity: make('calendar.benchmark_calendar', 'on', {
        friendly_name: 'Lab calendar',
        message: 'Firmware regression sweep',
        start_time: '2026-08-11 15:00:00',
        end_time: '2026-08-11 16:30:00',
        location: 'Lab bench 2',
        all_day: false,
      }, 5),
    },
    {
      kind: 'read',
      note: 'Group — member count and members list',
      entity: make('group.benchmark_group', 'on', {
        friendly_name: 'Rig lights',
        entity_id: ['light.benchmark_light_rgb', 'light.benchmark_light_temp', 'light.benchmark_light_dimmable'],
      }, 10),
    },
  ];
}

export function benchmarkEntities(entries: BenchmarkEntry[]): HassEntities {
  return Object.fromEntries(entries.map(e => [e.entity.entity_id, e.entity]));
}

export const BENCHMARK_DEVICE = {
  id: 'benchmark_rig',
  name: DEVICE_NAME,
  manufacturer: 'Open Home Foundation',
  model: 'Display Matrix v1',
  areaName: 'Test Lab',
};
