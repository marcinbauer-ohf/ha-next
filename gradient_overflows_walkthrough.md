# Gradient Overflows Implementation

## Changes

1.  **Sidebar Scroll Gradients**:
    - Modified `src/components/layout/Sidebar.tsx`.
    - Wrapped the navigation list in a relative container with `mask-linear-fade`.
    - Added top and bottom gradient overlays (`bg-gradient-to-b` and `bg-gradient-to-t` from `surface-default`).
    - Implemented scroll detection using `useRef` and `onScroll` to conditionally show/hide gradients based on scroll position.

2.  **Footer Activity Scroll Gradients**:
    - Modified `src/components/layout/StatusBar.tsx`.
    - Added left and right gradient overlays (`bg-gradient-to-r` and `bg-gradient-to-l`) to the scrollable activity widgets container.
    - Implemented horizontal scroll detection to toggle gradient visibility.

## Results

- Both the Sidebar and the Footer now provide visual cues (fading gradients) when content overflows the visible area.
- This improves the user experience by indicating that more content is available to scroll.
