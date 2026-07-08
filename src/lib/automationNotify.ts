import {
  mdiRobotOutline,
  mdiLockOpenAlertOutline,
  mdiWashingMachine,
  mdiHomeExportOutline,
} from '@mdi/js';
import type { ToastOptions } from '@/contexts/ToastContext';

type ShowToast = (opts: ToastOptions) => number;

export interface AutomationNotification {
  /** The automation that fired, in plain language (no entity IDs). */
  automation: string;
  icon: string;
  title: string;
  message: string;
  /** Optional call-to-action; omitted for purely informational notices. */
  actionLabel?: string;
  haptic?: ToastOptions['haptic'];
}

/**
 * Catalogue of notifications a Home Assistant automation might push to a
 * household member's app — the everyday "your home is telling you something"
 * messages that reach *every* user, admin or not. Placeholder until wired to
 * real HA notify.* / persistent_notification events.
 *
 * Front door is first so it's the one surfaced when a single notice is shown.
 */
export const AUTOMATION_NOTIFICATIONS: AutomationNotification[] = [
  {
    automation: 'Front door left unlocked',
    icon: mdiLockOpenAlertOutline,
    title: 'Front door left unlocked',
    message: "It's been unlocked for 12 min while nobody's home. Tap to lock it.",
    actionLabel: 'Lock it',
    haptic: 'warning',
  },
  {
    automation: 'Laundry finished',
    icon: mdiWashingMachine,
    title: 'Laundry is done',
    message: 'The washer just finished its cycle.',
  },
  {
    automation: 'Everyone left home',
    icon: mdiHomeExportOutline,
    title: 'Away mode is on',
    message: 'Turned off 4 lights and armed away mode.',
  },
];

/**
 * Surface one automation notification as a toast. The small robot badge marks
 * it as sent *by an automation* (vs. a discovery or system message), the
 * uppercase caption names the source, and `persist` keeps it in
 * settings → Notifications — a surface every user can see, so it demonstrates
 * that non-admins receive home-automation notifications too.
 */
export function announceAutomationNotification(showToast: ShowToast, n: AutomationNotification) {
  showToast({
    icon: n.icon,
    // Badge the tile with the automation robot: this came from an automation.
    protocolIcon: mdiRobotOutline,
    caption: 'Automation',
    title: n.title,
    subtitle: n.message,
    haptic: n.haptic,
    // Actionable notices (e.g. "Lock it") wait to be acted on; tapping handles
    // it. Informational ones tap to dismiss. Either way the whole card is the
    // affordance, matching the discovery toast.
    onClick: () => {},
    // Untouched for 20s: dismiss with the normal exit and pulse the status bar
    // so the notice lives on in the home's status surface.
    idleDismiss: 20000,
    // Keep it in settings → Notifications after dismissal so it can be acted on
    // later — this is what a non-admin user sees in their notification list.
    persist: true,
  });
}

/** Pick a random automation notification from the catalogue. */
export function pickAutomationNotification(): AutomationNotification {
  const i = Math.floor(Math.random() * AUTOMATION_NOTIFICATIONS.length);
  return AUTOMATION_NOTIFICATIONS[i];
}
