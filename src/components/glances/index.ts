// Glances — the family of small, live summary widgets (people, lights, energy…)
// shown in the dashboard summary row, the desktop Summary panel, and the
// screensaver. Every one opens a dialog: the simple ones are produced by
// useLiveSummaryItems and hosted by SummaryGlance, the richer ones (energy,
// automations) are components of their own here.
// See the GlanceId / SummaryCardProps docs in src/types.
export { EnergyGlance } from './EnergyGlance';
export { AutomationsGlance } from './AutomationsGlance';
export { SummaryGlance, type SummaryGlanceItem } from './SummaryGlance';
