export {
  HomeAssistantProvider,
  useHomeAssistant,
  useHomeAssistantEntities,
  useHomeAssistantSelector,
  useEntity,
  useEntities,
  useConnectionAlive,
  useRestartPending,
} from './useHomeAssistant';

export {
  useEntitiesByDomain,
  useEntitiesCount,
  useLightsOn,
  useDoorsOpen,
  useAverageTemperature,
} from './useEntities';

export { useAreasFloors, type AreasFloorsModel, type AreaWithCounts, type FloorWithAreas } from './useAreasFloors';

export { ThemeProvider, useTheme } from './useTheme';
export { FontProvider, useFont, FONTS, type FontKey, type FontOption } from './useFont';
export { FeatureFlagsProvider, useFeatureFlags } from './useFeatureFlags';
export { useFastScrollLabels } from './useFastScrollLabels';
export { useIdleMarquee } from './useIdleMarquee';
export { useWeatherParams } from './useWeatherParams';
export { HomeCenterPrefsProvider, useHomeCenterPrefs } from './useHomeCenterPrefs';
export { useActivities, type UseActivitiesResult } from './useActivities';

export { useIdleTimer } from './useIdleTimer';

export { useLongPress } from './useLongPress';

export { useCopyToClipboard } from './useCopyToClipboard';

export { useHomeEventReactor, REACTIVE_TRIGGER_KINDS, type ReactiveTriggerKind, type ReactiveTriggerConfig } from './useHomeEventReactor';
export { useHomePingPulse } from './useHomePingPulse';

export { useSidebarItems, type SidebarItem } from './useSidebarItems';
export { useSidebarExpanded } from './useSidebarExpanded';
export { useRunShortcut, defaultShortcutIcon } from './useRunShortcut';
export { useHomeSummary } from './useHomeSummary';
export { useDashboardThumbnailCapture } from './useDashboardThumbnailCapture';

export { ImmersiveModeProvider, useImmersiveMode } from './useImmersiveMode';
export { useDesktopImmersivePageLayout } from './useDesktopImmersivePageLayout';

export { usePullToReveal } from './usePullToReveal';

export { useSheetDrag } from './useSheetDrag';

export { useVacuumSimulator } from './useVacuumSimulator';

export { useStandaloneMode } from './useStandaloneMode';
export { useSectionCrumb } from './useSectionCrumb';
export { useScrollToEdges } from './useScrollToEdges';
export { useDevices, useDeviceStructure, useIntegrations, useDevicesList, DEVICE_CATEGORY_LABEL } from './useDevices';
export type { HassDevice, IntegrationSummary, IntegrationDevice, IntegrationStatus, IntegrationFlags, DeviceSummary } from './useDevices';
export { useAutomations, useAutomationActions, formatLastTriggered } from './useAutomations';
export type { AutomationSummary } from './useAutomations';
export { useEnergyMetrics } from './useEnergyMetrics';
export type { EnergyMetrics } from './useEnergyMetrics';
export { useDeviceCardConfig } from './useDeviceCardConfig';
export { useFavorites } from './useFavorites';
export type { DeviceCardConfig, EntitySlot, EntitySection } from './useDeviceCardConfig';
export { useDashboardLayout } from './useDashboardLayout';
export type { DashboardLayout, SectionConfig, CardConfig, CardColSpan, CardRowSpan } from './useDashboardLayout';
