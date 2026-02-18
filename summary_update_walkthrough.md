# Summary Sidebar and Mobile Pattern Update

## Changes

1.  **Removed Desktop Summary Sidebar**:
    - Removed the `SummariesPanel` sidebar from the desktop layout in `src/app/page.tsx`. This also removed the tips widget that was contained within it.
    - Removed the unused `SummariesPanel` import in `src/app/page.tsx`.

2.  **Enabled Mobile Summary Row on Desktop**:
    - Updated `MobileSummaryRow` in `src/components/sections/SummariesPanel.tsx` to be visible on desktop (removed `lg:hidden`).
    - Adjusted styling to ensure proper display on larger screens:
      - Reset negative margins (`lg:mx-0`).
      - Added padding (`lg:px-2`) to align with other content.
      - Ensured the row remains sticky at the top, consistent with the mobile pattern.

3.  **Adjusted Main Content Layout**:
    - Removed `lg:pt-ha-5` from the `main` container in `src/app/page.tsx` to allow the sticky summary row to sit flush at the top of the scrollable area, matching the mobile layout behavior.

## Results

- The summary sidebar is gone.
- The summary tiles (and people badge) are now displayed at the top of the dashboard on desktop, using the same sticky, horizontal scrolling pattern as on mobile.
- The tips widget is removed.
