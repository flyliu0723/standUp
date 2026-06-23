import koffi from 'koffi'
import { settingsService } from './settingsService'

const user32 = koffi.load('user32.dll')
const kernel32 = koffi.load('kernel32.dll')

const LASTINPUTINFO = koffi.struct('LASTINPUTINFO', {
  cbSize: 'uint32',
  dwTime: 'uint32'
})

const GetLastInputInfo = user32.func('bool GetLastInputInfo(_Out_ LASTINPUTINFO *plii)')
const GetTickCount = kernel32.func('uint32 GetTickCount()')

export class IdleService {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private onIdle: (() => void) | null = null
  private onActive: (() => void) | null = null

  setCallbacks(onIdle: () => void, onActive: () => void): void {
    this.onIdle = onIdle
    this.onActive = onActive
  }

  start(intervalMs = 30_000): void {
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

  getIdleMs(): number {
    const info = { cbSize: 8, dwTime: 0 }
    const ok = GetLastInputInfo(info)
    if (!ok) {
      return 0
    }
    const currentTick = GetTickCount()
    let idleMs = currentTick - info.dwTime
    if (idleMs < 0) {
      idleMs += 0x100000000
    }
    return idleMs
  }

  isIdle(): boolean {
    const thresholdMs = settingsService.getSettings().idleThresholdMinutes * 60 * 1000
    return this.getIdleMs() >= thresholdMs
  }

  private poll(): void {
    const settings = settingsService.getSettings()
    const thresholdMs = settings.idleThresholdMinutes * 60 * 1000
    const inactivePauseMs = Math.min(
      settings.inactivePauseMinutes * 60 * 1000,
      Math.max(30_000, thresholdMs - 1000)
    )
    const idleMs = this.getIdleMs()
    if (idleMs >= thresholdMs) {
      this.onIdle?.()
    } else if (idleMs < inactivePauseMs) {
      this.onActive?.()
    }
  }
}

export const idleService = new IdleService()
