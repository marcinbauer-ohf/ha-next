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
export { FeatureFlagsProvider, useFeatureFlags } from './useFeatureFlags';

export { useIdleTimer } from './useIdleTimer';

export { useHomeEventReactor, type ReactiveTriggerMode } from './useHomeEventReactor';

export { useSidebarItems, type SidebarItem } from './useSidebarItems';

export { ImmersiveModeProvider, useImmersiveMode } from './useImmersiveMode';
export { useDesktopImmersivePageLayout } from './useDesktopImmersivePageLayout';

export { usePullToReveal } from './usePullToReveal';

export { useStandaloneMode } from './useStandaloneMode';
export { useDevices } from './useDevices';
export type { HassDevice } from './useDevices';
export { useDeviceCardConfig } from './useDeviceCardConfig';
export type { DeviceCardConfig, EntitySlot, EntitySection } from './useDeviceCardConfig';
export { useDashboardLayout } from './useDashboardLayout';
export type { DashboardLayout, SectionConfig, CardConfig, CardColSpan, CardRowSpan } from './useDashboardLayout';
