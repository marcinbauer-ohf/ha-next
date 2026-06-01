# Mobile Header Transparency

## Changes

1.  **Transparent Mobile Top Bar with Gradient Scrim**:
    - Modified `src/app/globals.css`.
    - Added a mobile-only rule (`max-width: 1023px`) for `[data-component="MobileTopBar"]` that sets a transparent `background-color` and a top-down `linear-gradient` `background-image` fading from `--ha-color-surface-default` to transparent.
    - The gradient uses `color-mix` for the mid stop, matching the scrim pattern already used elsewhere in the stylesheet.
    - Themes with their own intentional chrome treatment (`glass`, `teenage`, `eink`) opt out via `background-image: none` so their existing app-bar styling is preserved.
    - Desktop is unaffected (the wrapper keeps `lg:bg-transparent`, and the rule is scoped to the mobile breakpoint).

## Results

- On mobile the top header is no longer a hard, solid band. It fades into the content below via a gradient scrim.
- In immersive / full-bleed views — where the dashboard surface and background imagery scroll behind the header — the gradient keeps the title, icons, and action buttons legible against whatever is underneath.
- In normal views the gradient fades into the matching surface color, so the change is seamless with no regression to existing layouts.
