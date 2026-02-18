# Simulations Container and Profile Badge Layout

## Changes

1.  **Independent Scrollable Simulations**:
    - Modified `MobileSummaryRow` in `src/components/sections/SummariesPanel.tsx`.
    - Separated the `PeopleBadge` (profile) from the scrollable list of simulations.
    - The `PeopleBadge` is now fixed on the left and remains visible while the simulations list scrolls independently.

2.  **Horizontal Scrolling with Gradients**:
    - Wrapped the simulations list in a `flex-1` container with `overflow-x-auto`.
    - Implemented left and right gradient overlays that fade in/out based on the scroll position to indicate overflow.
    - Used `useRef` and `onScroll` event listener to track scroll position and toggle gradients visibility dynamically.

## Results

- The profile badge is always visible and does not scroll away.
- The simulation badges are contained in a horizontally scrollable area to the right of the profile badge.
- Gradient overlays appear on the left/right edges of the simulations container when there is overflow in that direction.
