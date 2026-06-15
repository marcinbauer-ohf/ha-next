export {
  HomeAssistantProvider,
  useHomeAssistant,
  useHomeAssistantEntities,
  useHomeAssistantSelector,
  useEntity,
  useEntities,
} from './useHomeAssistant';

export {
  useEntitiesByDomain,
  useEntitiesCount,
  useLightsOn,
  useDoorsOpen,
  useAverageTemperature,
} from './useEntities';

export { ThemeProvider, useTheme } from './useTheme';
export { FontProvider, useFont, FONTS, type FontKey, type FontOption } from './useFont';
export { FeatureFlagsProvider, useFeatureFlags } from './useFeatureFlags';
export { HomeCenterPrefsProvider, useHomeCenterPrefs } from './useHomeCenterPrefs';

export { useIdleTimer } from './useIdleTimer';

export { useLongPress } from './useLongPress';

export { useHomeEventReactor, type ReactiveTriggerMode } from './useHomeEventReactor';

export { useSidebarItems, type SidebarItem } from './useSidebarItems';

export { ImmersiveModeProvider, useImmersiveMode } from './useImmersiveMode';
export { useDesktopImmersivePageLayout } from './useDesktopImmersivePageLayout';

export { usePullToReveal } from './usePullToReveal';

export { useStandaloneMode } from './useStandaloneMode';
export { useDevices, useDeviceStructure, useIntegrations } from './useDevices';
export type { HassDevice, IntegrationSummary, IntegrationDevice, IntegrationStatus, IntegrationFlags } from './useDevices';
export { useAutomations, useAutomationActions, formatLastTriggered } from './useAutomations';
export type { AutomationSummary } from './useAutomations';
export { useEnergyMetrics } from './useEnergyMetrics';
export type { EnergyMetrics } from './useEnergyMetrics';
export { useDeviceCardConfig } from './useDeviceCardConfig';
export type { DeviceCardConfig, EntitySlot, EntitySection } from './useDeviceCardConfig';
export { useDashboardLayout } from './useDashboardLayout';
export type { DashboardLayout, SectionConfig, CardConfig, CardColSpan, CardRowSpan } from './useDashboardLayout';
