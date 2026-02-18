# Widget Updates and Layout Fixes

## Changes

1.  **Independent Scrollable Widgets**:
    - Modified `src/components/layout/StatusBar.tsx`.
    - Separated the user profile avatar (fixed on the left) from the rest of the widgets.
    - Wrapped the variable widgets (Voice, Media, Timer, Camera, Printer) in a scrollable container (`overflow-x-auto`).
    - Added a flex container to manage the layout, ensuring the profile stays fixed while widgets scroll horizontally.

## Results

- The user profile avatar remains fixed on the left side of the footer.
- The activity widgets (voice, media, timers, etc.) are now contained within a horizontally scrollable area.
- This prevents the entire footer from scrolling or shifting, keeping the layout stable and the profile always accessible.
