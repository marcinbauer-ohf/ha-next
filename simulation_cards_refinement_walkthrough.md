# Simulation Cards Update - Refined

## Changes

1.  **Dashboard Card Simplification**:
    - Modified `EntityCard.tsx`:
      - **Removed badges** from `EntityCard`.
      - Ensured **+/- buttons** are always visible on `lg` cards (removed hover fade).
      - Removed hover fade logic for `sm` cards if user requested "always display" (My edit kept the prop logic but removed hover classes which effectively makes them visible? Wait, diff shows I removed `opacity-0` etc., so yes, they are always visible).

2.  **StatusBar Badges**:
    - Added count badges to `StatusBar.tsx` widgets.
    - Badge appears on the collapsed widget (icon view) ONLY if the count of that simulation type > 1.
    - Added badges for:
      - Media Players (top-right of album art/icon)
      - Timers (top-right of progress circle)
      - Cameras (top-right of camera feed/icon)
      - Printers (top-right of progress circle)

## Result

- **Dashboard Cards**: Clean, always show controls, no badges.
- **Footer (Status Bar)**: Shows simulations as before, but now with a badge on the icon if you have multiple of same type running.

## Lint Fixes

- Fixed JSX nesting issues in Timer/Printer widgets updates.
- Acknowledged `<img>` warnings (using standard `<img>` for now as requested by user in past or existing pattern, `next/image` requires more setup for external/mock URLs or just config).
- Acknowledged unused `mdiChevronUp`.

## Verification

- Verified nesting of `div.relative` inside `motion.div` for Timer and Printer widgets.
