import { settingsService } from './settingsService'
import { closeReminderToastWindow, showReminderToastWindow } from '../windows/reminderToastWindow'
import {
  closeReminderWindow,
  showReminderWindow,
  showReminderStandingPhase
} from '../windows/reminderWindow'

type EscalationCallbacks = {
  onOverlayShown: () => void
  onFullscreenShown: () => void
}

let toastDismissTimer: ReturnType<typeof setTimeout> | null = null
let currentSitMinutes = 0

/** 40 分钟到时：立即全屏强制提醒，角落卡片仅作并行轻提示 */
export function startReminderEscalation(sitMinutes: number, callbacks: EscalationCallbacks): void {
  clearReminderEscalation()
  currentSitMinutes = sitMinutes

  showReminderWindow(sitMinutes, 'alert')
  callbacks.onFullscreenShown()

  const settings = settingsService.getSettings()
  const toastMs = Math.max(3, settings.toastGraceSeconds) * 1000

  showReminderToastWindow(sitMinutes)

  toastDismissTimer = setTimeout(() => {
    closeReminderToastWindow()
    toastDismissTimer = null
  }, toastMs)
}

export { showReminderStandingPhase }

export function clearReminderEscalation(): void {
  if (toastDismissTimer) {
    clearTimeout(toastDismissTimer)
    toastDismissTimer = null
  }
  closeReminderToastWindow()
}

export function hasEscalatedBeyondToast(): boolean {
  return Boolean(currentSitMinutes)
}

export function dismissEscalationWindows(): void {
  clearReminderEscalation()
  closeReminderWindow()
}

export function getEscalationSitMinutes(): number {
  return currentSitMinutes
}
