import type { AppSettings, SessionStatus } from '../types/session'
import {
  closeDesktopPetWindow,
  hideDesktopPetWindow,
  showDesktopPetWindow
} from '../windows/desktopPetWindow'
import {
  closeStatusBarWindow,
  hideStatusBarWindow,
  showStatusBarWindow
} from '../windows/statusBarWindow'

export function syncAmbientDisplay(settings: AppSettings, status: SessionStatus): void {
  const mode = settings.ambientDisplayMode ?? 'none'

  if (mode === 'none') {
    hideStatusBarWindow()
    hideDesktopPetWindow()
    return
  }

  if (mode === 'statusBar') {
    hideDesktopPetWindow()
    if (status.state === 'offDuty') {
      hideStatusBarWindow()
    } else {
      showStatusBarWindow()
    }
    return
  }

  if (mode === 'desktopPet') {
    hideStatusBarWindow()
    showDesktopPetWindow()
  }
}

export function applyAmbientSettingsChange(settings: AppSettings, status: SessionStatus): void {
  const mode = settings.ambientDisplayMode ?? 'none'
  if (mode === 'none') {
    closeStatusBarWindow()
    closeDesktopPetWindow()
    return
  }
  syncAmbientDisplay(settings, status)
}

export function destroyAmbientDisplays(): void {
  closeStatusBarWindow()
  closeDesktopPetWindow()
}
