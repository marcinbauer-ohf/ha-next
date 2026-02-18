# Desktop Gradient Adjustment

## Changes

1.  **Refined Gradient Opacity**:
    - Updated `MobileSummaryRow` in `src/components/sections/SummariesPanel.tsx`.
    - Changed the gradient start color from `from-surface-lower/30` to `from-surface-lower` for both the left and right overflow indicators.
    - This ensures the gradient properly masks the content underneath, creating a smoother fade effect against the background, rather than a semi-transparent overlay that might look washed out.

## Results

- The left and right overflow gradients now fade seamlessly into the background color (`surface-lower`), providing a cleaner visual indication of scrollable content on desktop.
