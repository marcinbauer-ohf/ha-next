# Device Card — Implementation Spec

Handoff spec for rebuilding the current dashboard **device card** as a real Home Assistant
production card (Lovelace custom card / native card), using current HA styles and components.

Source of truth in this repo: `src/components/cards/DeviceCardV2.tsx` (the live card).
`DeviceCard.tsx` is a dead V1 kept only for the `/dev/device-card` preview — ignore it.

---

## 1. What it is

A **device-first tile**. A card represents one physical device (which may own several
entities), not a single entity. It shows:

- One **primary entity** as a big glanceable block (name, state, control, optional product image or camera feed).
- Zero or more **secondary entity rows** stacked under it (compact list, each with its own control/value).

Devices with a single entity render as just the primary block. Cameras/media players can
render as a full-bleed image hero. Sensors render a read-only value plus an inline history graph.

The card is **presentational only**. It receives fully-resolved props and calls back on
interaction. All entity→visual decisions happen in the caller (`renderCard`) using
`src/lib/homeassistant/entityHelpers.ts`. Port that logic too — it is where the card's
"intelligence" lives.

---

## 2. Visual anatomy

Container: rounded (`--ha-radius-2xl`), `overflow: hidden`, `background: surface-default`.
Two stacked regions: primary block (top) + optional secondary rows (bottom, divided by hairlines).

### Primary block — two layouts (dev flag `heroCardLayoutEnabled`)

**HERO (current design — build this one):**
```
┌──────────────────────────────┐
│ Area (eyebrow, muted)         │        ← name/text top-left
│ Device Name (bold)      [img] │        ← product PNG right-anchored,
│ state / value           [img] │          vertically centered, BEHIND text,
│ ····sparkline····             │          left edge masked to transparent
│ [toggle]                      │        ← control bottom-left
└──────────────────────────────┘
min-height 104px (mobile) / 136px (desktop)
```

**CLASSIC (previous, keep only if you want the toggle):** product image top-left, icon top row,
name+state bottom-left, toggle bottom-right. Not needed for the port unless you want it as an option.

### The four primary render modes

| Mode | Trigger | Look |
|---|---|---|
| **Toggleable** | `toggleable` true | Pill toggle bottom-left. Active → green tint (`green-500/10`), inactive → neutral surface. |
| **Read-only numeric** | `unit` present, not toggleable | State shown as prominent mono value; inline sparkline of recent history; no control. |
| **Pressable** | `pressable` true (button/script) | Small round action button (power icon) instead of pill. |
| **Camera/media hero** | `feedImage` present | Full-bleed cover image + bottom scrim; name/state in white with text-shadow. |

### State visuals

- **On/active + toggleable:** green tint background, hover/active deepen (`/0.16`, `/0.20`).
- **Off / neutral:** `surface-default`, hover `surface-low`, active `surface-mid`.
- **Unavailable / unknown:** amber inset ring (`ring-amber-500/40`), amber-tinted bg, `mdiAlertCircleOutline` top-right, label **"Offline"** + duration ("just now" / `5m` / `3h` / `2d` / `1w`). Product thumbnail dimmed+grayscaled. Secondary rows dimmed to 40% and non-interactive.
- **Selected:** 2px blue outline (`.ha-selected`), used while its detail sheet is open.
- **Last-opened:** softer one-shot flash (`.ha-last-opened`) after the sheet closes.
- **Edit mode:** blue inset ring on hover + pencil badge top-right; grab cursor; toggles disabled.

---

## 3. Data model (props)

```ts
interface DeviceCardEntity {
  entityId: string;
  icon: string;            // mdi path string (from @mdi/js)
  name: string;
  state: string;           // display state, e.g. "On", "21.5"
  lastChanged?: string;    // ISO — drives "Offline for 3h"
  active?: boolean;        // is-on, drives green tint
  entityPicture?: string;  // faint 20%-opacity background image
  thumbnail?: string|null; // product PNG; null = force icon, undefined = auto
  toggleable?: boolean;    // render pill toggle
  pressable?: boolean;     // render action button (button/script)
  unit?: string;           // unit_of_measurement; also gates sparkline + numeric styling
  chart?: boolean;         // secondary inline sparkline (default true)
  size?: 'sm'|'lg';        // 'sm' = compact row, no icon (default 'lg')
  onToggle?: () => void;
  onClick?: () => void;
  corner?: string;         // DORMANT — computed but not rendered (see §8 gaps)
  cornerLabel?: string;    // DORMANT
}

interface DeviceCardProps {
  primary: DeviceCardEntity;
  secondary?: DeviceCardEntity[];
  selected?: boolean;
  lastOpened?: boolean;
  editMode?: boolean;
  onLongPress?: () => void;
  className?: string;
  areaName?: string;       // eyebrow above name (used when grouped by type)
  feedImage?: string;      // device-level camera/media hero URL
}
```

---

## 4. Entity → visual mapping (port from `entityHelpers.ts`)

This is the logic the caller applies before constructing props. In HA you already have most
inputs natively (`hass.states`, domain, `device_class`, `attributes`).

- **isOn:** true unless state ∈ `{off, unavailable, unknown, 0, idle, standby}`. → `active`.
- **Toggleable domains:** `light, switch, fan, input_boolean, media_player, cover, lock`.
- **Pressable domains:** `button, script, automation, input_button`.
- **Icons (`domainIcon`):** per-domain + `device_class`. light→bulb (filled when on), switch→toggle-switch, climate→thermometer, media_player→tv/speaker, lock→open/closed, cover→garage, vacuum→robot, binary_sensor by class (door/window/motion/smoke), sensor by class (temperature/humidity/power→flash/illuminance/gauge). Fallback `mdiDevices`. **In HA use `stateIcon`/entity registry icons instead** — they already resolve this.
- **State label:** append `unit_of_measurement`.
- **Product thumbnail:** keyword+domain+device_class → `/devices/*.png` catalog (`deviceThumbnails.ts`). Optional; HA has no equivalent asset set (see gaps).
- **Camera/media hero:** first camera entity with `entity_picture`, else media_player artwork.
- **Multi-entity device → primary pick:** `DOMAIN_PRIORITY` (camera, climate, media_player, light, switch, fan, cover, lock, vacuum, … sensor last). Remaining entities become secondary rows.
- **Grouping / sections** (for the dashboard, not the card): `entityCategory` → security/entertainment/climate/lighting/sensors.

---

## 5. Interactions

- **Tap primary block** → `onClick`. In view mode: open the detail sheet for the device. In edit mode: select for editing.
- **Toggle** → `onToggle` → `homeassistant.toggle` / domain service. `stopPropagation` so it never opens the sheet; fires a haptic. Suppressed in edit mode.
- **Long-press (500ms) anywhere on card** → `onLongPress` → enter edit mode + select. View mode only.
- **Secondary row tap** → that entity's `onClick` (opens that entity). Row has its own toggle / action button / read-only value.
- **Sparkline hover (desktop)** → scrubs; the state text is replaced by the hovered value + timestamp.
- **Reorder / drag:** NOT on the card. Dashboard-level `@dnd-kit` handles moving cards between sections and into/out of a Favorites band; a separate edit panel drags entities between primary/secondary/hidden slots.

Detail sheet: a `ModalSheet` (bottom sheet, drag-to-dismiss) rendering `EntityDetailPanel` (stats/info tabs, per-entity `DomainControls` sliders/steppers, a Features entity list, and an edit pencil). In HA this maps to the **more-info dialog** — reuse `more-info` rather than rebuilding.

---

## 6. Secondary rows

- Row height ≥52px, hairline divider (`border-surface-lower`) between rows.
- `size:'lg'`: icon + name + (toggle | action button | value). `size:'sm'`: no icon, smaller text.
- Numeric rows: tiny inline history sparkline before the value; value uses **RollingNumericValue** (per-digit roll animation).
- Active toggleable row → green tint + green icon.
- Unavailable row → 50% opacity, alert icon, non-interactive.

---

## 7. Styling & special behaviors

Design tokens are CSS vars in `globals.css`, mapped to Tailwind utilities. When porting to HA,
map these to HA theme vars:

| This repo | HA theme var (suggested) |
|---|---|
| `surface-default` / `-low` / `-mid` / `-lower` | `--ha-card-background` / `--card-background-color` / ladder of `--divider-color` |
| `text-primary/secondary/tertiary/disabled` | `--primary-text-color` / `--secondary-text-color` / `--disabled-text-color` |
| green active tint | `--state-active-color` / `rgba(var(--rgb-primary-color), .1)` |
| amber unavailable | `--state-unavailable-color` / `--warning-color` |
| `ha-blue` (selection/edit) | `--primary-color` |
| `--ha-radius-2xl` | `--ha-card-border-radius` |

Behaviors that make the card feel alive (each is a distinct mechanism — decide per-behavior whether to port):

- **Idle marquee:** truncated name/area/label text scrolls horizontally when idle. Uses CSS `container-type: inline-size`; only text wider than its box moves (`translateX(min(0, 100cqw - 100%))`). Toggled by a class on the scroll container; paused, never removed (removing it flashes). Respects `prefers-reduced-motion`.
- **Fast-scroll gist labels:** a hidden overlay per card (big clamped name + area) that CSS-reveals when the scroll container is flung fast (velocity ≥1.6px/ms), so fast scrolling stays legible without re-rendering cards.
- **Inline sparkline (`EntityMiniSparkline`):** lazy-fetches entity history; the only self-fetching child. In HA, source from the history/recorder API.
- **Rolling numeric value:** per-digit odometer animation on change.
- **Enter animation:** `ha-card-in` fade/scale on lazy mount (via `DeferredCard`).
- **Memoization:** the dashboard rebuilds every card's props on each entity-store tick; the card is `memo`'d with a custom comparator over *display fields* (not object identity) so only the changed device re-renders. Critical for 20–50 card boards. Reproduce an equivalent in HA (native cards already do this via `hass` diffing).

---

## 8. What's missing / gaps to close on the port

1. **Corner badge is dormant.** `corner`/`cornerLabel` are defined, computed by callers (`primaryCornerBadge` — brightness%/fan%/temp°/volume%/power W/last-changed), compared in memo, but **never rendered**. Either wire the badge into the HERO layout's top-right, or drop the fields. This is the biggest "designed but unfinished" item.
2. **Product thumbnail catalog is bespoke.** `/devices/*.png` PNGs are hand-curated and keyword-matched. HA has no equivalent. Options: ship the asset set, fall back to entity/brand icons, or use HA's device integration icons. Card already reverts to the mdi icon on image error — keep that fallback.
3. **Two duplicated `renderCard` mappers** (home `page.tsx` and `DeviceSectionsView.tsx`) differ only in edit-mode gating and `areaName`. Consolidate into one shared mapper before/while porting.
4. **Two layouts behind a debug flag.** Decide HERO-only (recommended) and delete CLASSIC, or expose as a card config option.
5. **No per-domain rich controls on the card face.** Lights/covers/climate only get on/off on the tile; fine control lives in the detail sheet. If parity with HA tile-card features (brightness slider inline, etc.) is wanted, that's net-new.
6. **Detail sheet vs more-info.** This repo has a custom `EntityDetailPanel`. In HA production, prefer reusing the standard more-info dialog rather than porting the panel, unless the custom stats/Features UX is a requirement.
7. **`entityPicture` faint-background mode** (20% opacity full-bleed) is separate from `feedImage` hero mode — confirm which you want; they overlap conceptually.
8. **Accessibility:** decorative images are `aria-hidden`; the card relies on tap targets but has no explicit roles/labels on the primary block. Add `role`/`aria-label` (device name + state) and keyboard activation for the HA build.

---

## 9. File index (reference while porting)

| Concern | File |
|---|---|
| The card | `src/components/cards/DeviceCardV2.tsx` |
| Entity→visual helpers (port this) | `src/lib/homeassistant/entityHelpers.ts` |
| Device tree / primary pick | `src/hooks/useDevices.ts` |
| Per-device card config (slots, thumbnail override) | `src/hooks/useDeviceCardConfig.ts` |
| Thumbnail catalog | `src/lib/deviceThumbnails.ts` |
| Toggle | `src/components/ui/ToggleSwitch.tsx` |
| Sparkline | `src/components/ui/EntityMiniSparkline.tsx`, `Sparkline.tsx` |
| Rolling value | `src/components/ui/RollingNumericValue.tsx` |
| Detail sheet | `src/components/cards/EntityDetailPanel.tsx`, `DeviceControls.tsx` |
| Card editor | `src/components/cards/DeviceCardEditPanel.tsx` |
| Prop mappers (consumers) | `src/app/page.tsx` (`renderCard`), `src/components/sections/DeviceSectionsView.tsx` (`renderCard`) |
| Marquee / fast-scroll / animations CSS | `src/app/globals.css` |
| Toggle/service calls | `src/hooks/useHomeAssistant.tsx` (`toggleEntity`, `callService`) |
