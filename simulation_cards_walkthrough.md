# Simulation Cards Update

## Changes

1.  **Multiple Simulation Instances**:
    - Modified `src/app/page.tsx` to support creating multiple instances of simulated entities (Media, Timer, Camera, Printer).
    - Implemented `addSimulation` and `removeLastSimulation` logic using numeric suffixes (e.g., `_2`, `_3`).
    - Updated `getSimulatedEntities` to track all active simulations of a given type.

2.  **Dashboard UI Updates**:
    - Modified "Task bar activities" cards in `src/app/page.tsx`.
    - cards now display the **count** of active simulations if > 0.
    - Added **+/- buttons** to each card (revealed on hover for desktop, or always visible based on styling) to easily add or remove simulations.
    - Clicking a card with multiple active simulations now opens a **list modal**.

3.  **EntityCard Enhancements**:
    - Modified `src/components/cards/EntityCard.tsx`.
    - Added support for `count`, `onIncrement`, and `onDecrement` props.
    - Implemented a badge to show the count.
    - Added increment/decrement controls.

4.  **Simulation List Modal**:
    - Created `src/components/ui/SimulationListModal.tsx`.
    - Displays a list of active simulations for a selected type.
    - Allows removing individual simulations.

5.  **StatusBar Update**:
    - Updated `src/components/layout/StatusBar.tsx` to correctly detect and display multiple simulated cameras.

## Results

- You can now add multiple timers, cameras, etc. by clicking the "+" button on the dashboard cards.
- A badge indicates how many are active.
- Clicking the card allows managing the list of active simulations.
