/**
 * Haptic Feedback Utilities (no-op stubs)
 *
 * Previously used Telegram's native haptic API.
 * Kept as no-op stubs for any remaining callers.
 */

export type HapticFeedbackType = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
export type HapticNotificationType = 'error' | 'success' | 'warning';

export function triggerHaptic(_style: HapticFeedbackType = 'light'): void {
  // no-op
}

export function triggerNotificationHaptic(_type: HapticNotificationType): void {
  // no-op
}

export function triggerSelectionHaptic(): void {
  // no-op
}

export function useHaptic() {
  return {
    impact: triggerHaptic,
    notification: triggerNotificationHaptic,
    selection: triggerSelectionHaptic,
  };
}
