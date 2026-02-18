# Voice Assistant Layout Update

## Changes

1.  **Fixed Voice Assistant Widget**:
    - Modified `src/components/layout/StatusBar.tsx`.
    - Moved the Voice Assistant widget (`Ask your home...`) out of the scrollable activity container.
    - It is now placed alongside the user profile avatar in the fixed left section of the footer.
    - This ensures that the voice assistant is always immediately accessible and doesn't get pushed off-screen if there are many active notifications or statuses.

## Results

- The footer now has two fixed elements on the left: the User Profile and the Voice Assistant.
- The remaining activity widgets (Media, Timers, Cameras, Printers) continue to reside in the scrollable container to the right of these fixed elements.
