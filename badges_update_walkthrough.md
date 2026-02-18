# Badges Update and Full Width Background

## Changes

1.  **Full Width Badge Background**:
    - Modified `src/app/page.tsx` to remove the `max-w-[1240px]` constraint from the main content wrapper.
    - Wrapped the dashboard sections in `src/app/page.tsx` with a new `div` that reapplies the `max-w-[1240px]` constraint, ensuring the main dashboard content remains centered and constrained.
    - Updated `MobileSummaryRow` in `src/components/sections/SummariesPanel.tsx` to include an inner container with `max-w-[1240px]`, ensuring the badge content aligns with the dashboard content while the background expands to the full width.

2.  **Dark Colored Badges**:
    - Updated `src/components/cards/SummaryCard.tsx` to use dark background colors (`bg-surface-low`) for `primary`, `success`, `yellow`, and `default` states.
    - Preserved the `danger` state color (`bg-fill-danger-normal`) for critical information.
    - Updated `PeopleBadge` in `src/components/sections/SummariesPanel.tsx` to use `bg-surface-low` instead of `bg-fill-primary-quiet`.
    - Updated the placeholder avatar background in `PeopleBadge` to `bg-surface-mid` for better contrast.

## Results

- The sticky summary row background now spans the full width of the dashboard container/viewport.
- The badges and dashboard content remain aligned within the central 1240px column.
- All badges (except critical ones) now use a dark, neutral background style, with color reserved for icons or text.
