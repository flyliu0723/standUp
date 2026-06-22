import { powerMonitor } from 'electron'
import { settingsService } from './settingsService'

type TimerCallback = () => void
export type TimerKind = 'sit' | 'stand'

export class TimerService {
  private timeoutId: ReturnType<typeof setTimeout> | null = null
  private deadlineAt = 0
  private pausedRemainingMs = 0
  private running = false
  private onExpire: TimerCallback | null = null
  private suspended = false
  private readonly kind: TimerKind

  constructor(kind: TimerKind) {
    this.kind = kind
    powerMonitor.on('suspend', () => this.handleSuspend())
    powerMonitor.on('resume', () => this.handleResume())
  }

  setOnExpire(callback: TimerCallback): void {
    this.onExpire = callback
  }

  getKind(): TimerKind {
    return this.kind
  }

  getRemainingMs(): number {
    if (this.running && this.deadlineAt > 0) {
      return Math.max(0, this.deadlineAt - Date.now())
    }
    return this.pausedRemainingMs
  }

  getDeadlineAt(): number {
    if (this.running && this.deadlineAt > 0) {
      return this.deadlineAt
    }
    if (this.pausedRemainingMs > 0) {
      return Date.now() + this.pausedRemainingMs
    }
    return 0
  }

  getIntervalMs(): number {
    const settings = settingsService.getSettings()
    const minutes =
      this.kind === 'stand' ? settings.standIntervalMinutes : settings.sitIntervalMinutes
    return minutes * 60 * 1000
  }

  start(fullReset = true): void {
    this.clear()
    const intervalMs = this.getIntervalMs()
    const remaining = fullReset ? intervalMs : this.pausedRemainingMs || intervalMs
    this.startWithDuration(remaining)
  }

  startWithDuration(durationMs: number): void {
    this.clear()
    const remaining = Math.max(durationMs, 1)
    this.deadlineAt = Date.now() + remaining
    this.pausedRemainingMs = remaining
    this.running = true
    this.suspended = false
    this.schedule()
  }

  pause(): void {
    if (!this.running) {
      return
    }
    this.pausedRemainingMs = this.getRemainingMs()
    this.deadlineAt = 0
    this.clear()
    this.running = false
  }

  resume(): void {
    if (this.running) {
      return
    }
    if (this.pausedRemainingMs <= 0) {
      this.start(true)
      return
    }
    this.deadlineAt = Date.now() + this.pausedRemainingMs
    this.running = true
    this.schedule()
  }

  snooze(minutes?: number): void {
    const mins = minutes ?? settingsService.getSettings().snoozeMinutes
    this.clear()
    const remaining = mins * 60 * 1000
    this.deadlineAt = Date.now() + remaining
    this.pausedRemainingMs = remaining
    this.running = true
    this.suspended = false
    this.schedule()
  }

  stop(): void {
    this.clear()
    this.running = false
    this.deadlineAt = 0
    this.pausedRemainingMs = 0
    this.suspended = false
  }

  restore(remainingMs: number): void {
    if (remainingMs <= 0) {
      return
    }
    this.clear()
    this.deadlineAt = Date.now() + remainingMs
    this.pausedRemainingMs = remainingMs
    this.running = true
    this.suspended = false
    this.schedule()
  }

  isExpired(): boolean {
    return this.getRemainingMs() <= 0 && (this.running || this.pausedRemainingMs > 0)
  }

  /** 补偿 setTimeout 被节流时错过的到期回调 */
  checkAndExpire(): boolean {
    if (!this.running || this.deadlineAt <= 0 || Date.now() < this.deadlineAt) {
      return false
    }
    this.clear()
    this.running = false
    this.deadlineAt = 0
    this.pausedRemainingMs = 0
    this.onExpire?.()
    return true
  }

  private schedule(): void {
    this.clear()
    const delay = this.getRemainingMs()
    if (delay <= 0) {
      this.running = false
      this.deadlineAt = 0
      this.pausedRemainingMs = 0
      this.onExpire?.()
      return
    }
    this.timeoutId = setTimeout(() => {
      this.running = false
      this.deadlineAt = 0
      this.pausedRemainingMs = 0
      this.onExpire?.()
    }, delay)
  }

  private clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  private handleSuspend(): void {
    if (!this.running) {
      return
    }
    this.suspended = true
    this.pause()
  }

  private handleResume(): void {
    if (!this.suspended) {
      return
    }
    this.suspended = false
    if (this.pausedRemainingMs > 0) {
      this.resume()
    }
  }
}

export const sitTimer = new TimerService('sit')
export const standTimer = new TimerService('stand')

/** @deprecated 使用 sitTimer */
export const timerService = sitTimer
