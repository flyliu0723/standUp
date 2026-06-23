import { randomUUID } from 'crypto'
import { dialog } from 'electron'
import Store from 'electron-store'
import { idleService } from './idleService'
import { settingsService } from './settingsService'
import { statsService } from './statsService'
import { sitTimer, standTimer } from './timerService'
import { workScheduleService } from './workScheduleService'
import { closeReminderWindow, getReminderWindow } from '../windows/reminderWindow'
import { closeReminderToastWindow, showIdeDeferWindow } from '../windows/reminderToastWindow'
import { showStandCompleteToast } from './notificationService'
import { shouldOfferIdeDefer, getIdeGuardContext } from './ideGuardService'
import {
  startReminderEscalation,
  clearReminderEscalation,
  dismissEscalationWindows,
  hasEscalatedBeyondToast,
  showReminderStandingPhase
} from './reminderEscalation'
import { applyAmbientSettingsChange } from './ambientDisplayService'
import { updateStatusBarLayout } from '../windows/statusBarWindow'
import { gamificationService } from './gamificationService'
import { activityMonitorService } from './activityMonitorService'
import { aiAnalysisService } from './aiAnalysisService'
import {
  PersistedRuntime,
  SessionEndReason,
  SessionStatus,
  SessionType,
  StandReasonId,
  TimerMode,
  WorkState,
  AppSettings
} from '../types/session'
import { getStandReasonConfig, STAND_REASON_LABELS } from '../constants/standReasons'

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

/** 当前段不足该时长时，忽略手动起立/坐下（防误触） */
const MIN_TOGGLE_INTERVAL_MS = 60_000

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
  private ideDeferPending = false
  private pausedBeforeState: WorkState = 'sitting'
  private pausedUntil = 0
  private awayEnteredAt = 0
  private awaySitEndAt = 0
  private awayConfirmInProgress = false
  private activeSessionStartAt = 0
  private inactivePauseActive = false
  private reminderResponsePending = false
  private currentStandReason: StandReasonId | null = null
  private currentStandDurationMs = 0
  private pauseReason: StandReasonId | null = null
  private currentPauseId: string | null = null
  private pausePlannedMs = 0

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
    this.awaySitEndAt = runtime.awaySitEndAt ?? 0
    this.pauseReason = runtime.pauseReason ?? null

    this.migrateAwayState()

    statsService.checkDateRollover()
    this.restoreTimers(runtime)
    this.checkPauseExpired()
  }

  applySettingsChange(partial: Partial<AppSettings>): AppSettings {
    const previous = settingsService.getSettings()
    const saved = settingsService.saveSettings(partial)

    if (
      partial.sitIntervalMinutes !== undefined &&
      partial.sitIntervalMinutes !== previous.sitIntervalMinutes &&
      this.state === 'sitting'
    ) {
      sitTimer.start(true)
      this.persist()
      this.emitState()
    }

    if (
      partial.standIntervalMinutes !== undefined &&
      partial.standIntervalMinutes !== previous.standIntervalMinutes &&
      this.state === 'standing'
    ) {
      standTimer.start(true)
      this.persist()
      this.emitState()
    }

    if (partial.ambientDisplayMode !== undefined) {
      applyAmbientSettingsChange(saved, this.getStatus())
    }

    if (partial.statusBarDisplayId !== undefined || partial.statusBarEdge !== undefined) {
      applyAmbientSettingsChange(saved, this.getStatus())
      updateStatusBarLayout()
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
    clearReminderEscalation()

    if (action === 'stand') {
      const ok = this.acknowledgeStand()
      if (ok) {
        showReminderStandingPhase(this.getReminderSitMinutes())
      }
    } else {
      const ok = this.snoozeFromReminder()
      if (ok) {
        closeReminderWindow()
      }
    }
    this.emitState()
  }

  deferForIde(): boolean {
    if (!this.ideDeferPending) {
      return false
    }
    this.ideDeferPending = false
    closeReminderToastWindow()
    return this.snoozeFromReminder()
  }

  forceReminderAfterIdeDefer(): void {
    if (!this.ideDeferPending) {
      return
    }
    this.ideDeferPending = false
    closeReminderToastWindow()
    this.beginReminderFlow()
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
      this.standUpWithReason('other')
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
    } else if (this.state === 'paused' && this.pausedUntil > Date.now()) {
      timerRemainingMs = this.pausedUntil - Date.now()
    }

    const pauseTimerTotalMs =
      this.state === 'paused' && this.pausePlannedMs > 0 ? this.pausePlannedMs : undefined

    return {
      state: this.state,
      currentSitMs: this.getCurrentSitMs(),
      currentStandMs: this.getCurrentStandMs(),
      timerRemainingMs,
      timerMode,
      sitIntervalMinutes: settings.sitIntervalMinutes,
      standIntervalMinutes: settings.standIntervalMinutes,
      isPaused: this.state === 'paused',
      pausedUntil: this.state === 'paused' && this.pausedUntil > Date.now() ? this.pausedUntil : undefined,
      isInactivePaused: this.inactivePauseActive,
      standReasonLabel:
        this.state === 'standing' && this.currentStandReason
          ? STAND_REASON_LABELS[this.currentStandReason]
          : undefined,
      pauseReasonLabel:
        this.state === 'paused' && this.pauseReason ? STAND_REASON_LABELS[this.pauseReason] : undefined,
      standTimerTotalMs:
        this.state === 'standing'
          ? this.currentStandDurationMs || settings.standIntervalMinutes * 60_000
          : undefined,
      pauseTimerTotalMs
    }
  }

  isPaused(): boolean {
    return this.state === 'paused'
  }

  pauseReminder(minutes: number): void {
    this.pausePlannedMs = minutes * 60_000
    this.pauseReason = null
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
    this.finishPauseRecord()
    const wasLongPause = this.pauseReason !== null
    this.pauseReason = null
    this.pausedUntil = 0

    if (wasLongPause && this.pausedBeforeState === 'sitting' && !this.currentSessionId) {
      this.state = 'sitting'
      this.startSitSession()
      this.persist()
      this.emitState()
      return
    }

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
    if (this.state === 'standing' && this.isStandSegmentTooShort()) {
      return
    }
    if (this.state === 'offDuty') {
      statsService.markWorkStart()
      activityMonitorService.resumeUsageTracking()
    }

    if (this.state === 'standing') {
      this.endCurrentSession('manual')
    }

    this.currentStandReason = null
    this.currentStandDurationMs = 0
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
    this.standUpWithReason('other')
  }

  standUpWithReason(reasonId: StandReasonId): void {
    if (this.state !== 'sitting') {
      return
    }
    if (this.isSitSegmentTooShort()) {
      return
    }

    const config = getStandReasonConfig(reasonId)
    if (this.reminderActive) {
      this.resolveReminderResponseAsStand()
      this.clearReminderFlow()
    }

    if (config.mode === 'paused') {
      this.beginLongPause(reasonId, config.durationMinutes)
      return
    }

    this.beginStanding('manual', reasonId, config.durationMinutes)
  }

  acknowledgeStand(fromAuto = false): boolean {
    if (this.state !== 'sitting') {
      return false
    }
    this.reminderActive = false
    this.stopReminderWatch()
    this.clearToastGraceTimer()
    clearReminderEscalation()
    if (this.reminderResponsePending) {
      this.completeReminderResponse(fromAuto ? 'on_time' : this.getStandResponseType())
    }
    this.autoStandPending = fromAuto
    this.standingOnReminder = true
    this.beginStanding(fromAuto ? 'auto_idle' : 'reminder')
    return true
  }

  sitDownFromReminder(): boolean {
    statsService.checkDateRollover()
    if (this.state === 'standing') {
      if (this.isStandSegmentTooShort()) {
        return false
      }
      this.autoStandPending = false
      this.standingOnReminder = false
      this.endCurrentSession('manual')
      this.startSitSession()
      this.dismissReminderIfOpen()
    }
    return true
  }

  snoozeFromReminder(): boolean {
    if (this.state !== 'sitting') {
      return false
    }
    this.completeReminderResponse('delayed')
    this.ideDeferPending = false
    this.reminderActive = false
    this.stopReminderWatch()
    this.clearToastGraceTimer()
    clearReminderEscalation()
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
    this.exitInactivePause()
    if (this.state === 'paused') {
      this.finishPauseRecord()
      this.pauseReason = null
      this.pausedUntil = 0
    }
    if (this.state === 'sitting' || this.state === 'standing' || this.state === 'away') {
      if (this.state === 'away') {
        if (this.awaySitEndAt > 0) {
          statsService.addAwayMs(Date.now() - this.awaySitEndAt)
        }
      } else {
        this.flushActiveSegment()
        if (this.currentSessionId) {
          this.endCurrentSession('endWork')
        }
      }
    }
    this.resetReminderFlags()
    this.state = 'offDuty'
    this.currentSessionId = null
    this.currentSessionType = null
    this.sessionAccumulatedMs = 0
    this.segmentStartAt = 0
    this.awayEnteredAt = 0
    this.awaySitEndAt = 0
    sitTimer.stop()
    standTimer.stop()
    activityMonitorService.pauseUsageTracking()
    this.persist()
    this.emitState()
    aiAnalysisService.triggerOnWorkEnd()
  }

  getReminderSitMinutes(): number {
    const settings = settingsService.getSettings()
    const sitMs = this.getCurrentSitMs()
    if (sitMs > 0) {
      return Math.max(1, Math.round(sitMs / 60_000))
    }
    return settings.sitIntervalMinutes
  }

  private beginStanding(
    reason: SessionEndReason,
    standReasonId?: StandReasonId,
    durationMinutes?: number
  ): void {
    this.flushActiveSegment()
    this.endCurrentSession(reason)
    this.recordGamificationBreak()

    const settings = settingsService.getSettings()
    const mins = durationMinutes ?? settings.standIntervalMinutes
    this.currentStandReason = standReasonId ?? null
    this.currentStandDurationMs = mins * 60_000
    this.pauseReason = null

    this.state = 'standing'
    this.currentSessionType = 'standing'
    this.currentSessionId = randomUUID()
    this.sessionAccumulatedMs = 0
    this.segmentStartAt = Date.now()
    this.activeSessionStartAt = this.segmentStartAt
    statsService.startSession(this.currentSessionId, 'standing', this.segmentStartAt, standReasonId)

    sitTimer.stop()
    standTimer.startWithDuration(this.currentStandDurationMs)
    activityMonitorService.resetContinuousActive()
    this.persist()
    this.emitState()
  }

  private beginLongPause(reasonId: StandReasonId, durationMinutes: number): void {
    this.clearReminderFlow()
    this.exitInactivePause()
    this.flushActiveSegment()

    if (this.state === 'sitting' && this.currentSessionId) {
      this.endCurrentSession('manual')
    }

    sitTimer.stop()
    standTimer.stop()
    this.currentStandReason = null
    this.currentStandDurationMs = 0
    this.pauseReason = reasonId
    this.pausePlannedMs = durationMinutes * 60_000
    this.currentPauseId = statsService.startPauseRecord(reasonId, durationMinutes)
    this.pausedBeforeState = 'sitting'
    this.state = 'paused'
    this.pausedUntil = Date.now() + durationMinutes * 60_000
    this.segmentStartAt = 0
    this.persist()
    this.emitState()
  }

  private finishPauseRecord(): void {
    if (this.currentPauseId) {
      statsService.endPauseRecord(this.currentPauseId)
      this.currentPauseId = null
    }
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
    this.exitInactivePause()
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

    const thresholdMs = settingsService.getSettings().idleThresholdMinutes * 60_000
    const now = Date.now()
    this.awayEnteredAt = now
    this.awaySitEndAt = Math.max(this.activeSessionStartAt, now - thresholdMs)

    if (this.currentSessionId) {
      this.endCurrentSession('idle', this.awaySitEndAt)
    }

    this.state = 'away'
    this.persist()
    this.emitState()
  }

  private async handleAwayReturn(): Promise<void> {
    if (this.state !== 'away' || this.awayConfirmInProgress) {
      return
    }
    this.awayConfirmInProgress = true

    const awayStartAt = this.awaySitEndAt || this.awayEnteredAt
    const awayMs = Date.now() - awayStartAt
    const awayMinutes = Math.max(1, Math.round(awayMs / 60_000))

    try {
      const { response } = await dialog.showMessageBox({
        type: 'question',
        buttons: ['去休息了', '我还在座位'],
        defaultId: 1,
        cancelId: 1,
        title: 'standUp — 离座确认',
        message: `检测到约 ${awayMinutes} 分钟无键鼠操作`,
        detail: '这段时间算休息（起立），还是继续计入久坐？'
      })

      if (response === 0) {
        this.resolveAwayAsBreak()
      } else {
        this.resolveAwayStillSitting()
      }
    } finally {
      this.awayEnteredAt = 0
      this.awaySitEndAt = 0
      this.awayConfirmInProgress = false
      this.persist()
      this.emitState()
    }
  }

  /** 场景 A：用户确实去休息了 */
  private resolveAwayAsBreak(): void {
    const now = Date.now()
    statsService.recordBreakFromAway()
    this.recordGamificationBreak()

    this.state = 'standing'
    this.currentSessionType = 'standing'
    this.currentSessionId = randomUUID()
    this.sessionAccumulatedMs = 0
    this.segmentStartAt = now
    this.activeSessionStartAt = now
    statsService.startSession(this.currentSessionId, 'standing', now)

    sitTimer.stop()
    standTimer.start(true)
  }

  /** 场景 B：用户仍在座位，空闲时间计入久坐 */
  private resolveAwayStillSitting(): void {
    const now = Date.now()
    const sitStartAt = this.awaySitEndAt || this.awayEnteredAt

    this.state = 'sitting'
    this.currentSessionType = 'sitting'
    this.currentSessionId = randomUUID()
    this.sessionAccumulatedMs = 0
    this.segmentStartAt = now
    this.activeSessionStartAt = sitStartAt
    statsService.startSession(this.currentSessionId, 'sitting', sitStartAt)

    sitTimer.resume()
  }

  private handleIdle(): void {
    const settings = settingsService.getSettings()
    const idleMs = idleService.getIdleMs()
    const awayThresholdMs = settings.idleThresholdMinutes * 60_000
    const inactivePauseMs = Math.min(
      settings.inactivePauseMinutes * 60_000,
      Math.max(30_000, awayThresholdMs - 1000)
    )

    if (this.state === 'sitting' && !this.reminderActive) {
      if (idleMs >= awayThresholdMs) {
        this.exitInactivePause()
        this.enterAway()
      } else if (idleMs >= inactivePauseMs && !this.inactivePauseActive) {
        this.enterInactivePause()
      }
    }
    this.checkAutoStandOnReminder()
  }

  private handleActive(): void {
    if (this.inactivePauseActive && this.state === 'sitting') {
      this.exitInactivePause()
    }
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
    if (shouldOfferIdeDefer()) {
      this.beginIdeDeferFlow()
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

  private beginIdeDeferFlow(): void {
    this.reminderActive = true
    this.ideDeferPending = true
    this.markReminderTriggered()
    const ctx = getIdeGuardContext()
    const snoozeMinutes = settingsService.getSettings().snoozeMinutes
    showIdeDeferWindow(ctx?.label ?? 'IDE', snoozeMinutes)
    this.emitState()
  }

  private beginReminderFlow(): void {
    this.reminderActive = true
    this.toastHandled = false
    this.ideDeferPending = false
    this.markReminderTriggered()
    const minutes = this.getReminderSitMinutes()

    this.reminderListeners.forEach((fn) => fn(minutes))
    this.startReminderWatch()

    startReminderEscalation(minutes, {
      onOverlayShown: () => {},
      onFullscreenShown: () => {
        this.onReminderShown()
      }
    })
    this.emitState()
  }

  private checkAutoStandOnReminder(): void {
    if (!this.reminderActive) {
      return
    }
    const autoMs = settingsService.getSettings().autoStandIdleMinutes * 60 * 1000
    if (idleService.getIdleMs() >= autoMs) {
      if (this.acknowledgeStand(true)) {
        showReminderStandingPhase(this.getReminderSitMinutes())
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

  private isSitSegmentTooShort(): boolean {
    return this.state === 'sitting' && this.getCurrentSitMs() < MIN_TOGGLE_INTERVAL_MS
  }

  private isStandSegmentTooShort(): boolean {
    return this.state === 'standing' && this.getCurrentStandMs() < MIN_TOGGLE_INTERVAL_MS
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
    if (this.reminderResponsePending) {
      this.completeReminderResponse('ignored')
    }
    this.reminderActive = false
    this.ideDeferPending = false
    this.stopReminderWatch()
    this.clearToastGraceTimer()
    dismissEscalationWindows()
  }

  private markReminderTriggered(): void {
    if (this.reminderResponsePending) {
      return
    }
    this.reminderResponsePending = true
    statsService.recordReminderTriggered()
  }

  private completeReminderResponse(response: 'on_time' | 'delayed' | 'ignored'): void {
    if (!this.reminderResponsePending) {
      return
    }
    statsService.recordReminderResponse(response)
    this.reminderResponsePending = false
  }

  private getStandResponseType(): 'on_time' | 'delayed' {
    return hasEscalatedBeyondToast() ? 'delayed' : 'on_time'
  }

  private resolveReminderResponseAsStand(): void {
    this.completeReminderResponse(this.getStandResponseType())
  }

  private enterInactivePause(): void {
    if (this.state !== 'sitting' || this.inactivePauseActive || this.reminderActive) {
      return
    }
    sitTimer.pause()
    this.inactivePauseActive = true
    this.persist()
    this.emitState()
  }

  private exitInactivePause(): void {
    if (!this.inactivePauseActive) {
      return
    }
    this.inactivePauseActive = false
    if (this.state === 'sitting' && !this.reminderActive) {
      sitTimer.resume()
    }
    this.persist()
    this.emitState()
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
      this.finishPauseRecord()
      const wasLongPause = this.pauseReason !== null
      this.pauseReason = null
      this.pausedUntil = 0

      if (wasLongPause && this.pausedBeforeState === 'sitting' && !this.currentSessionId) {
        this.state = 'sitting'
        this.startSitSession()
        this.persist()
        return
      }

      this.exitPaused()
      this.persist()
    }
  }

  private migrateAwayState(): void {
    if (this.state !== 'away') {
      return
    }
    if (!this.awaySitEndAt && this.awayEnteredAt) {
      const thresholdMs = settingsService.getSettings().idleThresholdMinutes * 60_000
      this.awaySitEndAt = Math.max(this.activeSessionStartAt, this.awayEnteredAt - thresholdMs)
    }
    if (this.currentSessionId) {
      const sitEndAt = this.awaySitEndAt || Date.now()
      statsService.endSession(this.currentSessionId, 'idle', sitEndAt)
      this.currentSessionId = null
      this.currentSessionType = null
      this.sessionAccumulatedMs = 0
      this.segmentStartAt = 0
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
      awayEnteredAt: this.awayEnteredAt || undefined,
      awaySitEndAt: this.awaySitEndAt || undefined,
      pauseReason: this.pauseReason ?? undefined
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
