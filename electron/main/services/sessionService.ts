import { randomUUID } from 'crypto'
import { dialog } from 'electron'
import Store from 'electron-store'
import { idleService } from './idleService'
import { settingsService } from './settingsService'
import { statsService } from './statsService'
import { sitTimer, standTimer } from './timerService'
import { workScheduleService } from './workScheduleService'
import { closeReminderWindow, getReminderWindow, sendReminderPhase } from '../windows/reminderWindow'
import { closeReminderToast, showReminderToast, showStandCompleteToast } from './notificationService'
import { gamificationService } from './gamificationService'
import {
  PersistedRuntime,
  SessionEndReason,
  SessionStatus,
  SessionType,
  TimerMode,
  WorkState,
  AppSettings
} from '../types/session'

interface RuntimeStoreSchema {
  runtime: PersistedRuntime
}

const store = new Store<RuntimeStoreSchema>({
  name: 'standup-runtime',
  defaults: {
    runtime: { state: 'offDuty' }
  }
})

type StateListener = (status: SessionStatus) => void
type ReminderListener = (sitMinutes: number) => void
type FullscreenReminderListener = (sitMinutes: number) => void

export class SessionService {
  private state: WorkState = 'offDuty'
  private currentSessionId: string | null = null
  private currentSessionType: SessionType | null = null
  private sessionAccumulatedMs = 0
  private segmentStartAt = 0
  private stateListeners = new Set<StateListener>()
  private reminderListeners = new Set<ReminderListener>()
  private fullscreenReminderListeners = new Set<FullscreenReminderListener>()
  private reminderActive = false
  private autoStandPending = false
  private standingOnReminder = false
  private reminderWatchTimer: ReturnType<typeof setInterval> | null = null
  private toastGraceTimer: ReturnType<typeof setTimeout> | null = null
  private toastHandled = false
  private pausedBeforeState: WorkState = 'sitting'
  private pausedUntil = 0
  private awayEnteredAt = 0
  private awayConfirmInProgress = false
  private activeSessionStartAt = 0

  init(): void {
    sitTimer.setOnExpire(() => this.handleSitTimerExpire())
    standTimer.setOnExpire(() => this.handleStandTimerExpire())
    idleService.setCallbacks(
      () => this.handleIdle(),
      () => this.handleActive()
    )
    idleService.start(10_000)

    const runtime = store.get('runtime')
    this.state = runtime.state
    this.currentSessionId = runtime.currentSessionId ?? null
    this.currentSessionType = runtime.currentSessionType ?? null
    this.sessionAccumulatedMs = runtime.sessionAccumulatedMs ?? 0
    this.segmentStartAt = runtime.segmentStartAt ?? 0
    this.pausedBeforeState = runtime.pausedBeforeState ?? 'sitting'
    this.pausedUntil = runtime.pausedUntil ?? 0
    this.awayEnteredAt = runtime.awayEnteredAt ?? 0

    statsService.checkDateRollover()
    this.restoreTimers(runtime)
    this.checkPauseExpired()
  }

  applySettingsChange(partial: Partial<AppSettings>): AppSettings {
    const saved = settingsService.saveSettings(partial)

    if (
      partial.sitIntervalMinutes !== undefined &&
      this.state === 'sitting'
    ) {
      sitTimer.start(true)
      this.persist()
      this.emitState()
    }

    if (
      partial.standIntervalMinutes !== undefined &&
      this.state === 'standing'
    ) {
      standTimer.start(true)
      this.persist()
      this.emitState()
    }

    return saved
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  onReminder(listener: ReminderListener): () => void {
    this.reminderListeners.add(listener)
    return () => this.reminderListeners.delete(listener)
  }

  onFullscreenReminder(listener: FullscreenReminderListener): () => void {
    this.fullscreenReminderListeners.add(listener)
    return () => this.fullscreenReminderListeners.delete(listener)
  }

  handleToastAction(action: 'stand' | 'snooze'): void {
    if (!this.reminderActive || this.toastHandled) {
      return
    }
    this.toastHandled = true
    this.clearToastGraceTimer()
    closeReminderToast()

    if (action === 'stand') {
      this.acknowledgeStand()
    } else {
      const ok = this.snoozeFromReminder()
      if (ok) {
        closeReminderWindow()
      }
    }
    this.emitState()
  }

  onReminderShown(): void {
    this.reminderActive = true
    this.startReminderWatch()
  }

  onReminderClosed(): void {
    this.reminderActive = false
    this.stopReminderWatch()
  }

  toggleSitStand(): void {
    if (this.state === 'paused') {
      this.resumeFromPause()
      return
    }
    if (this.state === 'offDuty') {
      this.startWork()
    } else if (this.state === 'sitting') {
      this.standUp()
    } else if (this.state === 'standing') {
      this.sitDown()
    }
  }

  getStatus(): SessionStatus {
    const settings = settingsService.getSettings()
    this.checkPauseExpired()

    const timerMode = this.getTimerMode()
    let timerRemainingMs = 0
    if (timerMode === 'sit') {
      timerRemainingMs = sitTimer.getRemainingMs()
    } else if (timerMode === 'stand') {
      timerRemainingMs = standTimer.getRemainingMs()
    }

    return {
      state: this.state,
      currentSitMs: this.getCurrentSitMs(),
      currentStandMs: this.getCurrentStandMs(),
      timerRemainingMs,
      timerMode,
      sitIntervalMinutes: settings.sitIntervalMinutes,
      standIntervalMinutes: settings.standIntervalMinutes,
      isPaused: this.state === 'paused',
      pausedUntil: this.state === 'paused' && this.pausedUntil > Date.now() ? this.pausedUntil : undefined
    }
  }

  isPaused(): boolean {
    return this.state === 'paused'
  }

  pauseReminder(minutes: number): void {
    this.enterPaused(Date.now() + minutes * 60_000)
  }

  pauseUntilEndOfDay(): void {
    const endAt = workScheduleService.getWorkEndTimestamp()
    const until = endAt > Date.now() ? endAt : Date.now() + 60_000
    this.enterPaused(until)
  }

  resumeFromPause(): void {
    if (this.state !== 'paused') {
      return
    }
    this.pausedUntil = 0
    this.exitPaused()
    this.persist()
    this.emitState()
  }

  deferReminderForFullscreen(): void {
    if (this.state !== 'sitting' || this.isPaused()) {
      return
    }
    this.pauseReminder(15)
  }

  startWork(): void {
    statsService.markWorkStart()
    this.sitDown()
  }

  sitDown(): void {
    statsService.checkDateRollover()
    if (this.state === 'sitting') {
      this.dismissReminderIfOpen()
      return
    }
    if (this.state === 'offDuty') {
      statsService.markWorkStart()
    }

    if (this.state === 'standing') {
      this.endCurrentSession('manual')
    }

    this.resetReminderFlags()
    this.state = 'sitting'
    this.currentSessionType = 'sitting'
    this.currentSessionId = randomUUID()
    this.sessionAccumulatedMs = 0
    this.segmentStartAt = Date.now()
    this.activeSessionStartAt = this.segmentStartAt
    statsService.startSession(this.currentSessionId, 'sitting', this.segmentStartAt)
    standTimer.stop()
    sitTimer.start(true)
    this.persist()
    this.emitState()
    this.dismissReminderIfOpen()
  }

  standUp(): void {
    if (this.state !== 'sitting') {
      return
    }
    this.beginStanding('manual')
  }

  acknowledgeStand(fromAuto = false): boolean {
    if (this.state !== 'sitting') {
      return false
    }
    this.reminderActive = false
    this.stopReminderWatch()
    this.clearToastGraceTimer()
    closeReminderToast()
    this.autoStandPending = fromAuto
    this.standingOnReminder = true
    this.beginStanding(fromAuto ? 'auto_idle' : 'reminder')
    return true
  }

  sitDownFromReminder(): boolean {
    statsService.checkDateRollover()
    if (this.state === 'standing') {
      this.autoStandPending = false
      this.standingOnReminder = false
      this.endCurrentSession('manual')
      this.startSitSession()
    }
    return true
  }

  snoozeFromReminder(): boolean {
    if (this.state !== 'sitting') {
      return false
    }
    this.reminderActive = false
    this.stopReminderWatch()
    this.clearToastGraceTimer()
    closeReminderToast()
    this.resetReminderFlags()

    const mins = settingsService.getSettings().snoozeMinutes
    statsService.recordSnooze(mins)
    sitTimer.snooze(mins)
    this.persist()
    this.emitState()
    return true
  }

  isStandingOnReminder(): boolean {
    return this.standingOnReminder
  }

  confirmReminderManually(): void {
    this.acknowledgeStand()
  }

  snoozeReminder(): void {
    this.snoozeFromReminder()
  }

  endWork(): void {
    this.clearReminderFlow()
    if (this.state === 'sitting' || this.state === 'standing' || this.state === 'away') {
      this.flushActiveSegment()
      if (this.currentSessionId) {
        this.endCurrentSession('endWork')
      }
    }
    this.resetReminderFlags()
    this.state = 'offDuty'
    this.currentSessionId = null
    this.currentSessionType = null
    this.sessionAccumulatedMs = 0
    this.segmentStartAt = 0
    this.awayEnteredAt = 0
    sitTimer.stop()
    standTimer.stop()
    this.persist()
    this.emitState()
  }

  getReminderSitMinutes(): number {
    const settings = settingsService.getSettings()
    const sitMs = this.getCurrentSitMs()
    if (sitMs > 0) {
      return Math.max(1, Math.round(sitMs / 60_000))
    }
    return settings.sitIntervalMinutes
  }

  private beginStanding(reason: SessionEndReason): void {
    this.flushActiveSegment()
    this.endCurrentSession(reason)
    this.recordGamificationBreak()

    this.state = 'standing'
    this.currentSessionType = 'standing'
    this.currentSessionId = randomUUID()
    this.sessionAccumulatedMs = 0
    this.segmentStartAt = Date.now()
    this.activeSessionStartAt = this.segmentStartAt
    statsService.startSession(this.currentSessionId, 'standing', this.segmentStartAt)

    sitTimer.stop()
    standTimer.start(true)
    this.persist()
    this.emitState()
  }

  private startSitSession(): void {
    this.state = 'sitting'
    this.currentSessionType = 'sitting'
    this.currentSessionId = randomUUID()
    this.sessionAccumulatedMs = 0
    this.segmentStartAt = Date.now()
    this.activeSessionStartAt = this.segmentStartAt
    statsService.startSession(this.currentSessionId, 'sitting', this.segmentStartAt)
    standTimer.stop()
    sitTimer.start(true)
    this.persist()
    this.emitState()
    this.dismissReminderIfOpen()
  }

  private enterPaused(until: number): void {
    this.clearReminderFlow()
    this.flushActiveSegment()

    if (this.state === 'sitting' || this.state === 'standing' || this.state === 'away') {
      this.pausedBeforeState = this.state
    }

    if (this.state === 'sitting' || this.state === 'away') {
      sitTimer.pause()
    } else if (this.state === 'standing') {
      standTimer.pause()
    }

    this.state = 'paused'
    this.pausedUntil = until
    this.segmentStartAt = 0
    this.persist()
    this.emitState()
  }

  private exitPaused(): void {
    const target = this.pausedBeforeState
    this.state = target === 'away' ? 'sitting' : target

    if (this.state === 'sitting') {
      if (!this.currentSessionId) {
        this.startSitSession()
        return
      }
      this.segmentStartAt = Date.now()
      sitTimer.resume()
    } else if (this.state === 'standing') {
      if (!this.currentSessionId) {
        this.beginStanding('manual')
        return
      }
      this.segmentStartAt = Date.now()
      standTimer.resume()
    }
  }

  private enterAway(): void {
    if (this.state !== 'sitting') {
      return
    }
    this.flushActiveSegment()
    this.segmentStartAt = 0
    sitTimer.pause()
    this.awayEnteredAt = Date.now()
    this.state = 'away'
    this.persist()
    this.emitState()
  }

  private async handleAwayReturn(): Promise<void> {
    if (this.state !== 'away' || this.awayConfirmInProgress) {
      return
    }
    this.awayConfirmInProgress = true

    const idleMs = Date.now() - this.awayEnteredAt
    const idleMinutes = Math.max(1, Math.round(idleMs / 60_000))

    try {
      const { response } = await dialog.showMessageBox({
        type: 'question',
        buttons: ['去休息了', '我还在座位'],
        defaultId: 1,
        cancelId: 1,
        title: 'standUp — 离座确认',
        message: `检测到约 ${idleMinutes} 分钟无键鼠操作`,
        detail: '这段时间算休息（起立），还是继续计入久坐？'
      })

      if (response === 0) {
        this.resolveAwayAsBreak()
      } else {
        this.resolveAwayStillSitting()
      }
    } finally {
      this.awayEnteredAt = 0
      this.awayConfirmInProgress = false
      this.persist()
      this.emitState()
    }
  }

  /** 场景 A：用户确实去休息了 */
  private resolveAwayAsBreak(): void {
    const thresholdMs = settingsService.getSettings().idleThresholdMinutes * 60_000
    const sitEndAt = Math.max(this.activeSessionStartAt, this.awayEnteredAt - thresholdMs)

    if (this.currentSessionId) {
      statsService.endSession(this.currentSessionId, 'auto_idle', sitEndAt)
      this.currentSessionId = null
      this.currentSessionType = null
    }

    this.recordGamificationBreak()
    this.state = 'standing'
    this.currentSessionType = 'standing'
    this.currentSessionId = randomUUID()
    this.sessionAccumulatedMs = 0
    this.segmentStartAt = Date.now()
    this.activeSessionStartAt = sitEndAt
    statsService.startSession(this.currentSessionId, 'standing', sitEndAt)

    sitTimer.stop()
    standTimer.start(true)
  }

  /** 场景 B：用户仍在座位，空闲时间计入久坐 */
  private resolveAwayStillSitting(): void {
    const idleMs = Date.now() - this.awayEnteredAt
    this.sessionAccumulatedMs += idleMs
    this.state = 'sitting'
    this.segmentStartAt = Date.now()
    sitTimer.resume()
  }

  private handleIdle(): void {
    if (this.state === 'sitting') {
      this.enterAway()
    }
    this.checkAutoStandOnReminder()
  }

  private handleActive(): void {
    if (this.state === 'away') {
      void this.handleAwayReturn()
      return
    }
    if (this.state === 'standing' && this.autoStandPending && this.standingOnReminder) {
      this.sitDownFromReminder()
    }
  }

  private handleSitTimerExpire(): void {
    if (this.state !== 'sitting') {
      return
    }
    if (this.reminderActive) {
      return
    }
    this.beginReminderFlow()
  }

  private handleStandTimerExpire(): void {
    if (this.state !== 'standing') {
      return
    }
    showStandCompleteToast()
    standTimer.stop()
    this.persist()
    this.emitState()
  }

  private beginReminderFlow(): void {
    this.reminderActive = true
    this.toastHandled = false
    const minutes = this.getReminderSitMinutes()

    this.reminderListeners.forEach((fn) => fn(minutes))
    showReminderToast(minutes)
    this.startReminderWatch()

    // 倒计时归零后立即全屏提醒，与系统通知并行（不再等待 toastGraceSeconds）
    this.fullscreenReminderListeners.forEach((fn) => fn(minutes))
    this.emitState()
  }

  private checkAutoStandOnReminder(): void {
    if (!this.reminderActive) {
      return
    }
    const autoMs = settingsService.getSettings().autoStandIdleMinutes * 60 * 1000
    if (idleService.getIdleMs() >= autoMs) {
      if (this.acknowledgeStand(true)) {
        sendReminderPhase('standing')
      }
    }
  }

  private startReminderWatch(): void {
    this.stopReminderWatch()
    this.reminderWatchTimer = setInterval(() => {
      this.checkAutoStandOnReminder()
    }, 5000)
  }

  private stopReminderWatch(): void {
    if (this.reminderWatchTimer) {
      clearInterval(this.reminderWatchTimer)
      this.reminderWatchTimer = null
    }
  }

  private flushActiveSegment(): void {
    if (this.segmentStartAt <= 0) {
      return
    }
    const delta = Date.now() - this.segmentStartAt
    this.sessionAccumulatedMs += delta
    this.segmentStartAt = 0
  }

  private getCurrentSitMs(): number {
    if (this.currentSessionType !== 'sitting') {
      return 0
    }
    if (this.state === 'sitting' && this.segmentStartAt > 0) {
      return this.sessionAccumulatedMs + (Date.now() - this.segmentStartAt)
    }
    return this.sessionAccumulatedMs
  }

  private getCurrentStandMs(): number {
    if (this.currentSessionType !== 'standing') {
      return 0
    }
    if (this.state === 'standing' && this.segmentStartAt > 0) {
      return this.sessionAccumulatedMs + (Date.now() - this.segmentStartAt)
    }
    return this.sessionAccumulatedMs
  }

  private getTimerMode(): TimerMode {
    if (this.state === 'sitting') {
      return 'sit'
    }
    if (this.state === 'standing') {
      return 'stand'
    }
    return 'none'
  }

  private endCurrentSession(reason: SessionEndReason, endAt?: number): void {
    if (this.currentSessionId) {
      statsService.endSession(this.currentSessionId, reason, endAt)
    }
    this.currentSessionId = null
    this.currentSessionType = null
    this.sessionAccumulatedMs = 0
    this.segmentStartAt = 0
    this.activeSessionStartAt = 0
  }

  private resetReminderFlags(): void {
    this.autoStandPending = false
    this.standingOnReminder = false
  }

  private clearReminderFlow(): void {
    this.reminderActive = false
    this.stopReminderWatch()
    this.clearToastGraceTimer()
    closeReminderToast()
    closeReminderWindow()
  }

  private clearToastGraceTimer(): void {
    if (this.toastGraceTimer) {
      clearTimeout(this.toastGraceTimer)
      this.toastGraceTimer = null
    }
  }

  private dismissReminderIfOpen(): void {
    if (!getReminderWindow()) {
      return
    }
    closeReminderWindow()
    this.onReminderClosed()
  }

  private recordGamificationBreak(): void {
    const goal = settingsService.getSettings().dailyBreakGoal
    const todayBreaks = statsService.getTodayStats().breakCount + 1
    gamificationService.recordBreak(todayBreaks >= goal)
  }

  private checkPauseExpired(): void {
    if (this.state === 'paused' && this.pausedUntil > 0 && this.pausedUntil <= Date.now()) {
      this.pausedUntil = 0
      this.exitPaused()
      this.persist()
    }
  }

  private restoreTimers(runtime: PersistedRuntime): void {
    if (this.state === 'paused') {
      return
    }

    const sitDeadline = runtime.sitDeadlineAt ?? runtime.timerDeadlineAt
    const standDeadline = runtime.standDeadlineAt

    if (this.state === 'sitting' && sitDeadline) {
      const remaining = sitDeadline - Date.now()
      if (remaining <= 0) {
        setTimeout(() => this.handleSitTimerExpire(), 500)
      } else {
        sitTimer.restore(remaining)
      }
    }

    if (this.state === 'away' && sitDeadline) {
      const remaining = sitDeadline - Date.now()
      if (remaining > 0) {
        sitTimer.restore(remaining)
        sitTimer.pause()
      }
    }

    if (this.state === 'standing' && standDeadline) {
      const remaining = standDeadline - Date.now()
      if (remaining <= 0) {
        setTimeout(() => this.handleStandTimerExpire(), 500)
      } else {
        standTimer.restore(remaining)
      }
    }
  }

  private persist(): void {
    store.set('runtime', {
      state: this.state,
      currentSessionId: this.currentSessionId ?? undefined,
      currentSessionType: this.currentSessionType ?? undefined,
      sessionAccumulatedMs: this.sessionAccumulatedMs || undefined,
      segmentStartAt: this.segmentStartAt || undefined,
      sitDeadlineAt: sitTimer.getDeadlineAt() || undefined,
      standDeadlineAt: standTimer.getDeadlineAt() || undefined,
      pausedBeforeState: this.state === 'paused' ? this.pausedBeforeState : undefined,
      pausedUntil: this.pausedUntil > Date.now() ? this.pausedUntil : undefined,
      awayEnteredAt: this.awayEnteredAt || undefined
    })
  }

  checkTimers(): void {
    if (this.state !== 'sitting' && this.state !== 'standing') {
      return
    }
    if (this.state === 'sitting' && !this.reminderActive) {
      sitTimer.checkAndExpire()
    } else if (this.state === 'standing') {
      standTimer.checkAndExpire()
    }
  }

  tickPersist(): void {
    if (this.state === 'sitting' || this.state === 'standing') {
      if (this.state === 'sitting' && !this.reminderActive) {
        if (sitTimer.checkAndExpire()) {
          return
        }
        if (sitTimer.getRemainingMs() <= 0) {
          this.handleSitTimerExpire()
        }
      }
      if (this.state === 'standing') {
        if (standTimer.checkAndExpire()) {
          return
        }
        if (standTimer.getRemainingMs() <= 0) {
          this.handleStandTimerExpire()
        }
      }
      this.persist()
    }
  }

  private emitState(): void {
    const status = this.getStatus()
    this.stateListeners.forEach((fn) => fn(status))
  }
}

export const sessionService = new SessionService()
