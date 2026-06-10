# Device-type thumbnails

Product renders shown in place of the mdi icon on the **top-left of each device
card's hero (primary) entity** on the dashboard. Mapped by `deviceThumbnail()`
in `src/lib/homeassistant/entityHelpers.ts` off `domain` + `device_class` +
entity_id/name keyword hints.

Source art: `~/Desktop/smart-devices-v1/` (copied + renamed). 51 files.

Most appliance / infrastructure renders (washer, fridge, printer, router, hub,
dongles, watch…) are matched by **name keyword regardless of domain** — they
surface under many domains (sensor, switch, device_tracker, update, event)
rather than a dedicated one. See the keyword block at the top of
`deviceThumbnail()`.

| filename                     | matches (domain · device_class / keyword)                 |
|------------------------------|-----------------------------------------------------------|
| `air_quality.png`            | sensor · pm25/pm10/aqi                                    |
| `ceiling_fan.png`            | fan                                                       |
| `contact_sensor.png`         | binary_sensor · door/window/garage_door/opening          |
| `energy_meter.png`           | sensor · power/energy/current/voltage / "clamp"          |
| `glass_break.png`            | binary_sensor · sound / "glass break"                    |
| `camera_dome.png`            | camera (default)                                         |
| `led_strip.png`              | light · "strip"/"led"                                     |
| `lux_sensor.png`             | sensor · illuminance / "lux"                              |
| `camera_bullet.png`          | camera · "bullet"/"outdoor"                               |
| `motion_sensor.png`          | binary_sensor · motion/occupancy/presence                |
| `keypad.png`                 | alarm_control_panel                                      |
| `ac_controller.png`          | climate · "ac"/"aircon"                                   |
| `bulb_e27.png`               | light (default)                                         |
| `bulb_gu10.png`              | light · "gu10"/"spot"                                     |
| `lock.png`                   | lock                                                     |
| `dimmer.png`                 | light/switch · "dimmer"                                   |
| `wall_switch.png`            | switch (default)                                        |
| `smart_plug_eu.png`          | switch · outlet + "eu"/"schuko"                          |
| `smart_plug_us.png`          | switch · outlet (default)                               |
| `power_strip.png`            | switch · "power strip"/"strip"                           |
| `radiator_valve.png`         | climate · "trv"/"valve"/"radiator"                       |
| `relay_module.png`           | switch · "relay"/"module"/"inline"                       |
| `siren.png`                  | siren                                                   |
| `thermostat.png`             | climate (default)                                       |
| `smoke_detector.png`         | binary_sensor · smoke/gas/carbon_monoxide                |
| `soil_sensor.png`            | sensor · moisture / "soil"                                |
| `temp_humidity_sensor.png`   | sensor · temperature/humidity                            |
| `vibration_sensor.png`       | binary_sensor · vibration                                |
| `doorbell.png`               | camera · "doorbell"/"bell"                                |
| `leak_sensor.png`            | binary_sensor · moisture                                 |
| `robot_vacuum.png`           | vacuum                                                   |
| `water_valve.png`            | valve                                                    |
| `button.png`                 | button / event                                           |
| `washing_machine.png`        | keyword "washing machine"/"washer"                       |
| `dishwasher.png`             | keyword "dishwasher"                                     |
| `fridge.png`                 | keyword "fridge"/"refrigerator"/"freezer"                |
| `air_purifier.png`           | keyword "air purifier"/"purifier"                        |
| `printer_3d.png`             | keyword "3d printer"/"octoprint"/"printer"               |
| `ups.png`                    | keyword "ups"/"uninterruptible"/"battery backup"         |
| `inverter.png`               | keyword "inverter"/"solar"                               |
| `ev_charger.png`             | keyword "ev charger"/"wallbox"/"ev"                       |
| `laptop.png`                 | keyword "laptop"/"macbook"/"notebook"                    |
| `wall_tablet.png`            | keyword "tablet"/"ipad"                                  |
| `wifi_router.png`            | keyword "router"/"mesh"/"access point"                   |
| `hub.png`                    | keyword "hub"/"bridge"/"gateway"/"coordinator"           |
| `zigbee_coordinator.png`     | keyword "zigbee"                                         |
| `zwave_controller.png`       | keyword "z-wave"/"zwave"                                 |
| `nfc_tag.png`                | tag domain / keyword "nfc"/"rfid"                        |
| `tracker.png`                | keyword "locator"/"tracker"/"airtag"/"tile"              |
| `smartwatch.png`             | keyword "smartwatch"/"watch"/"wearable"                  |
| `irrigation_controller.png`  | keyword "irrigation"/"sprinkler"                         |

Missing file → the card silently falls back to the mdi domain icon (img
`onError` in `DeviceCardV2`). Add a new mapping by extending `deviceThumbnail()`.
