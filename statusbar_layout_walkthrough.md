# StatusBar Layout Refactor

## Changes

1.  **Independent Widget Scrolling**:
    - Modified `src/components/layout/StatusBar.tsx` to separate the user profile avatar from the activity widgets (Voice, Media, Timer, Camera, Printer).
    - The Profile avatar is now in a fixed container (`flex-shrink-0`), ensuring it stays visible and does not scroll.
    - The activity widgets are wrapped in a `flex-1 overflow-x-auto` container, allowing them to scroll horizontally without affecting the profile or the overall footer layout.

## Results

- The StatusBar now correctly handles overflow of multiple active widgets.
- The user profile remains accessible on the left at all times.
- The layout prevents the entire footer from expanding or scrolling unexpectedly.
