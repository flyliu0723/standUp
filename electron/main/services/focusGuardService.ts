import koffi from 'koffi'
import { settingsService } from './settingsService'

const user32 = koffi.load('user32.dll')

const RECT = koffi.struct('RECT', {
  left: 'int32',
  top: 'int32',
  right: 'int32',
  bottom: 'int32'
})

const GetForegroundWindow = user32.func('void *GetForegroundWindow()')
const GetWindowRect = user32.func('bool GetWindowRect(void *hWnd, _Out_ RECT *lpRect)')
const GetSystemMetrics = user32.func('int32 GetSystemMetrics(int32 nIndex)')

const SM_CXSCREEN = 0
const SM_CYSCREEN = 1

export class FocusGuardService {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private onFullscreen: (() => void) | null = null

  setCallback(onFullscreen: () => void): void {
    this.onFullscreen = onFullscreen
  }

  start(intervalMs = 15_000): void {
    if (process.platform !== 'win32') {
      return
    }
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
    this.intervalId = setInterval(() => this.poll(), intervalMs)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  isForegroundFullscreen(): boolean {
    if (!settingsService.getSettings().autoDndFullscreen) {
      return false
    }
    try {
      const hwnd = GetForegroundWindow()
      if (!hwnd) {
        return false
      }
      const rect = { left: 0, top: 0, right: 0, bottom: 0 }
      const ok = GetWindowRect(hwnd, rect)
      if (!ok) {
        return false
      }
      const screenW = GetSystemMetrics(SM_CXSCREEN)
      const screenH = GetSystemMetrics(SM_CYSCREEN)
      const w = rect.right - rect.left
      const h = rect.bottom - rect.top
      return w >= screenW - 4 && h >= screenH - 4
    } catch {
      return false
    }
  }

  private poll(): void {
    if (this.isForegroundFullscreen()) {
      this.onFullscreen?.()
    }
  }
}

export const focusGuardService = new FocusGuardService()
