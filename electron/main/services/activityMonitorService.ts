import koffi from 'koffi'
import Store from 'electron-store'
import { idleService } from './idleService'
import { getForegroundProcessName, getForegroundWindowTitle } from './ideGuardService'
import { classifyApp } from './appCategoryService'
import { getAppLabel, type AppCategory } from '../constants/appCategories'
import { appUsageService } from './appUsageService'
import type { ActivitySnapshot, NeckRiskLevel } from '../types/session'

const user32 = koffi.load('user32.dll')

const POINT = koffi.struct('POINT', {
  x: 'int32',
  y: 'int32'
})
const GetCursorPos = user32.func('bool GetCursorPos(_Out_ POINT *lpPoint)')
const GetClipboardSequenceNumber = user32.func('uint32 GetClipboardSequenceNumber()')

const CURSOR_SAMPLE_MS = 2_000
const INPUT_POLL_MS = 500
const WINDOW_POLL_MS = 3_000
const AGGREGATE_MS = 10_000
const SAMPLE_RETENTION_MS = 10 * 60_000
const MOUSE_MOVE_THRESHOLD = 4

interface CursorSample {
  x: number
  y: number
  at: number
}

interface InputEvent {
  at: number
  type: 'keyboard' | 'mouse'
}

interface WindowSwitch {
  at: number
  app: string
}

interface ClipboardEvent {
  at: number
}

const FIVE_MIN_MS = 5 * 60_000

interface ActivityDailyStats {
  workMs: number
  entertainmentMs: number
  socialMs: number
  microActionCount: number
}

interface ActivityStoreSchema {
  daily: Record<string, ActivityDailyStats>
}

const activityStore = new Store<ActivityStoreSchema>({
  name: 'standup-activity',
  defaults: { daily: {} }
})

function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function readCursorPos(): { x: number; y: number } | null {
  if (process.platform !== 'win32') {
    return null
  }
  try {
    const point = { x: 0, y: 0 }
    const ok = GetCursorPos(point)
    if (!ok) {
      return null
    }
    return { x: point.x, y: point.y }
  } catch {
    return null
  }
}

function pruneByTime<T extends { at: number }>(items: T[], before: number): T[] {
  return items.filter((item) => item.at >= before)
}

function calcMouseRange(samples: CursorSample[]): { width: number; height: number } {
  if (samples.length < 2) {
    return { width: 0, height: 0 }
  }
  let minX = samples[0].x
  let maxX = samples[0].x
  let minY = samples[0].y
  let maxY = samples[0].y
  for (const s of samples) {
    minX = Math.min(minX, s.x)
    maxX = Math.max(maxX, s.x)
    minY = Math.min(minY, s.y)
    maxY = Math.max(maxY, s.y)
  }
  return { width: maxX - minX, height: maxY - minY }
}

function countEventsSince(events: InputEvent[], since: number, type?: InputEvent['type']): number {
  return events.filter((e) => e.at >= since && (type ? e.type === type : true)).length
}

function calcNeckRisk(params: {
  continuousActiveMinutes: number
  mouseRangeWidth: number
  mouseRangeHeight: number
  keyboardPerMinute: number
  mousePerMinute: number
  appCategory: AppCategory
  staticWorkIndex: number
}): NeckRiskLevel {
  if (params.staticWorkIndex >= 75) {
    return 'high'
  }
  const smallRange = params.mouseRangeWidth < 400 && params.mouseRangeHeight < 300
  const highInput = params.keyboardPerMinute >= 40 && params.mousePerMinute >= 8
  if (
    params.appCategory === 'work' &&
    params.continuousActiveMinutes >= 90 &&
    smallRange &&
    highInput
  ) {
    return 'high'
  }
  if (params.staticWorkIndex >= 45 || (params.continuousActiveMinutes >= 60 && smallRange)) {
    return 'medium'
  }
  return 'low'
}

export class ActivityMonitorService {
  private cursorSamples: CursorSample[] = []
  private inputEvents: InputEvent[] = []
  private windowSwitches: WindowSwitch[] = []
  private clipboardEvents: ClipboardEvent[] = []
  private lastClipboardSeq = 0
  private lastInputTick = 0
  private lastCursor: { x: number; y: number } | null = null
  private lastForegroundApp: string | null = null
  private lastForegroundTitle: string | null = null
  private foregroundSince = 0
  private categoryMs: Record<AppCategory, number> = {
    work: 0,
    entertainment: 0,
    social: 0,
    neutral: 0
  }
  private continuousActiveStart: number | null = null
  private cursorTimer: ReturnType<typeof setInterval> | null = null
  private inputTimer: ReturnType<typeof setInterval> | null = null
  private windowTimer: ReturnType<typeof setInterval> | null = null
  private aggregateTimer: ReturnType<typeof setInterval> | null = null
  private keyboardHookCount = 0
  private mouseHookCount = 0
  private hooksInstalled = false
  private usageTrackingEnabled = false
  /** 提醒解锁专用：仅在本应用键鼠 hook 检测到输入时重置 */
  private reminderUnlockLastInputAt = 0
  private lastUserInputAt = Date.now()

  pauseUsageTracking(): void {
    if (!this.usageTrackingEnabled) {
      appUsageService.flushCurrentSegment()
      return
    }
    const now = Date.now()
    if (this.lastForegroundApp && this.foregroundSince) {
      const duration = now - this.foregroundSince
      const category = classifyApp(this.lastForegroundApp, this.lastForegroundTitle)
      this.categoryMs[category] += duration
    }
    appUsageService.flushCurrentSegment(now)
    this.lastForegroundApp = null
    this.lastForegroundTitle = null
    this.foregroundSince = 0
    this.usageTrackingEnabled = false
  }

  resumeUsageTracking(): void {
    this.usageTrackingEnabled = true
  }

  isUsageTrackingEnabled(): boolean {
    return this.usageTrackingEnabled
  }

  start(): void {
    if (process.platform !== 'win32') {
      return
    }
    this.stop()
    this.loadTodayStats()
    this.installInputHooks()
    this.pollInput()
    this.pollCursor()
    this.pollWindow()

    this.cursorTimer = setInterval(() => this.pollCursor(), CURSOR_SAMPLE_MS)
    this.inputTimer = setInterval(() => this.pollInput(), INPUT_POLL_MS)
    this.windowTimer = setInterval(() => this.pollWindow(), WINDOW_POLL_MS)
    this.aggregateTimer = setInterval(() => this.aggregate(), AGGREGATE_MS)
  }

  stop(): void {
    if (this.cursorTimer) clearInterval(this.cursorTimer)
    if (this.inputTimer) clearInterval(this.inputTimer)
    if (this.windowTimer) clearInterval(this.windowTimer)
    if (this.aggregateTimer) clearInterval(this.aggregateTimer)
    this.cursorTimer = null
    this.inputTimer = null
    this.windowTimer = null
    this.aggregateTimer = null
    appUsageService.flushCurrentSegment()
    this.uninstallInputHooks()
  }

  getMouseEventCount(withinMs: number): number {
    const since = Date.now() - withinMs
    return countEventsSince(this.inputEvents, since, 'mouse')
  }

  beginReminderUnlockTracking(): void {
    this.reminderUnlockLastInputAt = Date.now()
  }

  endReminderUnlockTracking(): void {
    this.reminderUnlockLastInputAt = 0
  }

  isReminderUnlockTracking(): boolean {
    return this.reminderUnlockLastInputAt > 0
  }

  getReminderUnlockIdleMs(): number {
    if (this.reminderUnlockLastInputAt <= 0) {
      return idleService.getIdleMs()
    }
    return Math.max(0, Date.now() - this.reminderUnlockLastInputAt)
  }

  private markUserInput(): void {
    const now = Date.now()
    this.lastUserInputAt = now
    if (this.reminderUnlockLastInputAt > 0) {
      this.reminderUnlockLastInputAt = now
    }
  }

  getTimeSinceLastUserInputMs(): number {
    return Math.max(0, Date.now() - this.lastUserInputAt)
  }

  getSnapshot(): ActivitySnapshot {
    const now = Date.now()
    const since10m = now - SAMPLE_RETENTION_MS
    const recentSamples = pruneByTime(this.cursorSamples, since10m)
    const range = calcMouseRange(recentSamples)
    const windowSwitches10m = pruneByTime(this.windowSwitches, since10m).length
    const switchStats5m = this.getSwitchStats(FIVE_MIN_MS)
    const clipboardOps5m = pruneByTime(this.clipboardEvents, now - FIVE_MIN_MS).length
    const keyboardEvents = countEventsSince(this.inputEvents, now - 60_000, 'keyboard')
    const keyboardEvents15s = countEventsSince(this.inputEvents, now - 15_000, 'keyboard')
    const mouseEvents = countEventsSince(this.inputEvents, now - 60_000, 'mouse')
    const idleMs = idleService.getIdleMs()
    const processName = getForegroundProcessName()
    const windowTitle = getForegroundWindowTitle()
    const appCategory = classifyApp(processName, windowTitle)
    const continuousActiveMinutes = this.getContinuousActiveMinutes()
    const staticWorkIndex = this.calcStaticWorkIndex({
      continuousActiveMinutes,
      mouseRangeWidth: range.width,
      mouseRangeHeight: range.height,
      keyboardPerMinute: keyboardEvents,
      mousePerMinute: mouseEvents,
      appCategory,
      windowSwitches10m
    })
    const daily = this.getTodayStats()

    return {
      foregroundApp: processName,
      foregroundLabel: getAppLabel(processName) ?? processName,
      windowTitle,
      appCategory,
      keyboardPerMinute: keyboardEvents,
      mousePerMinute: mouseEvents,
      mouseRangeWidth: range.width,
      mouseRangeHeight: range.height,
      windowSwitches10m,
      windowSwitches5m: switchStats5m.count,
      distinctApps5m: switchStats5m.distinctApps,
      clipboardOps5m,
      keyboardEvents15s,
      continuousActiveMinutes,
      staticWorkIndex,
      neckRiskLevel: calcNeckRisk({
        continuousActiveMinutes,
        mouseRangeWidth: range.width,
        mouseRangeHeight: range.height,
        keyboardPerMinute: keyboardEvents,
        mousePerMinute: mouseEvents,
        appCategory,
        staticWorkIndex
      }),
      workMsToday: daily.workMs + this.categoryMs.work,
      entertainmentMsToday: daily.entertainmentMs + this.categoryMs.entertainment,
      socialMsToday: daily.socialMs + this.categoryMs.social,
      microActionCountToday: daily.microActionCount,
      isInputActive: idleMs < 30_000,
      idleMs
    }
  }

  getSwitchStats(withinMs: number): { count: number; distinctApps: number } {
    const since = Date.now() - withinMs
    const recent = pruneByTime(this.windowSwitches, since)
    const apps = new Set(recent.map((item) => item.app.toLowerCase()))
    return { count: recent.length, distinctApps: apps.size }
  }

  getMindWaveformBuckets(bucketCount = 8, bucketMs = 60_000): number[] {
    const now = Date.now()
    const buckets: number[] = []
    for (let i = bucketCount - 1; i >= 0; i -= 1) {
      const end = now - i * bucketMs
      const start = end - bucketMs
      const count = this.windowSwitches.filter((item) => item.at >= start && item.at < end).length
      buckets.push(Math.min(1, count / 8))
    }
    return buckets
  }

  getRecentSwitchApps(withinMs = SAMPLE_RETENTION_MS): string[] {
    const since = Date.now() - withinMs
    const apps = pruneByTime(this.windowSwitches, since).map((item) => item.app.toLowerCase())
    return [...new Set(apps)]
  }

  getContinuousActiveMinutes(): number {
    if (!this.continuousActiveStart) {
      return 0
    }
    return Math.floor((Date.now() - this.continuousActiveStart) / 60_000)
  }

  recordMicroAction(): void {
    const key = todayKey()
    const all = activityStore.get('daily')
    const daily = all[key] ?? { workMs: 0, entertainmentMs: 0, socialMs: 0, microActionCount: 0 }
    daily.microActionCount += 1
    all[key] = daily
    activityStore.set('daily', all)
    this.continuousActiveStart = Date.now()
  }

  resetContinuousActive(): void {
    this.continuousActiveStart = null
  }

  private loadTodayStats(): void {
    this.categoryMs = { work: 0, entertainment: 0, social: 0, neutral: 0 }
  }

  private getTodayStats(): ActivityDailyStats {
    const key = todayKey()
    const all = activityStore.get('daily')
    return all[key] ?? { workMs: 0, entertainmentMs: 0, microActionCount: 0 }
  }

  private persistCategoryMs(): void {
    const key = todayKey()
    const all = activityStore.get('daily')
    const daily = all[key] ?? { workMs: 0, entertainmentMs: 0, socialMs: 0, microActionCount: 0 }
    daily.workMs += this.categoryMs.work
    daily.entertainmentMs += this.categoryMs.entertainment
    daily.socialMs += this.categoryMs.social
    all[key] = daily
    activityStore.set('daily', all)
    this.categoryMs = { work: 0, entertainment: 0, social: 0, neutral: 0 }
  }

  private calcStaticWorkIndex(params: {
    continuousActiveMinutes: number
    mouseRangeWidth: number
    mouseRangeHeight: number
    keyboardPerMinute: number
    mousePerMinute: number
    appCategory: AppCategory
    windowSwitches10m: number
  }): number {
    if (params.continuousActiveMinutes <= 0) {
      return 0
    }
    let score = Math.min(60, params.continuousActiveMinutes * 0.6)
    const smallRange = params.mouseRangeWidth < 400 && params.mouseRangeHeight < 300
    if (smallRange) {
      score += 20
    }
    if (params.keyboardPerMinute >= 30 && params.mousePerMinute >= 5) {
      score += 15
    }
    if (params.appCategory === 'work') {
      score += 10
    }
    if (params.windowSwitches10m <= 2 && params.continuousActiveMinutes >= 30) {
      score += 10
    }
    return Math.min(100, Math.round(score))
  }

  private pollCursor(): void {
    const pos = readCursorPos()
    if (!pos) {
      return
    }
    const now = Date.now()
    this.cursorSamples.push({ ...pos, at: now })
    this.cursorSamples = pruneByTime(this.cursorSamples, now - SAMPLE_RETENTION_MS)
    this.lastCursor = pos
  }

  private pollClipboard(): void {
    if (process.platform !== 'win32') {
      return
    }
    try {
      const seq = GetClipboardSequenceNumber()
      if (this.lastClipboardSeq === 0) {
        this.lastClipboardSeq = seq
        return
      }
      if (seq !== this.lastClipboardSeq) {
        this.lastClipboardSeq = seq
        const now = Date.now()
        this.clipboardEvents.push({ at: now })
        this.clipboardEvents = pruneByTime(this.clipboardEvents, now - SAMPLE_RETENTION_MS)
      }
    } catch {
      // 剪贴板 API 不可用时静默跳过
    }
  }

  private pollInput(): void {
    this.pollClipboard()
    const idleMs = idleService.getIdleMs()
    if (idleMs >= 60_000) {
      this.continuousActiveStart = null
      return
    }
    if (idleMs < 30_000) {
      this.updateContinuousActive(true)
    } else {
      this.updateContinuousActive(false)
    }
    if (this.hooksInstalled) {
      return
    }

    const currentTick = Date.now() - idleMs
    if (this.lastInputTick === 0) {
      this.lastInputTick = currentTick
      return
    }
    if (currentTick === this.lastInputTick) {
      return
    }
    this.lastInputTick = currentTick
    const now = Date.now()
    this.markUserInput()
    const pos = readCursorPos()
    let type: InputEvent['type'] = 'keyboard'
    if (pos && this.lastCursor) {
      const dx = Math.abs(pos.x - this.lastCursor.x)
      const dy = Math.abs(pos.y - this.lastCursor.y)
      if (dx >= MOUSE_MOVE_THRESHOLD || dy >= MOUSE_MOVE_THRESHOLD) {
        type = 'mouse'
      }
    }
    this.inputEvents.push({ at: now, type })
    this.inputEvents = pruneByTime(this.inputEvents, now - SAMPLE_RETENTION_MS)
  }

  private pollWindow(): void {
    if (!this.usageTrackingEnabled) {
      return
    }

    const processName = getForegroundProcessName()
    const windowTitle = getForegroundWindowTitle()
    const now = Date.now()

    appUsageService.syncForeground(processName, windowTitle, now)

    if (processName !== this.lastForegroundApp) {
      if (this.lastForegroundApp && this.foregroundSince) {
        const duration = now - this.foregroundSince
        const category = classifyApp(this.lastForegroundApp, this.lastForegroundTitle)
        this.categoryMs[category] += duration
      }
      if (processName) {
        this.windowSwitches.push({ at: now, app: processName })
        this.windowSwitches = pruneByTime(this.windowSwitches, now - SAMPLE_RETENTION_MS)
      }
      this.lastForegroundApp = processName
      this.lastForegroundTitle = windowTitle
      this.foregroundSince = now
    } else {
      this.lastForegroundTitle = windowTitle
    }
  }

  private aggregate(): void {
    this.persistCategoryMs()
    const now = Date.now()
    this.cursorSamples = pruneByTime(this.cursorSamples, now - SAMPLE_RETENTION_MS)
    this.inputEvents = pruneByTime(this.inputEvents, now - SAMPLE_RETENTION_MS)
    this.windowSwitches = pruneByTime(this.windowSwitches, now - SAMPLE_RETENTION_MS)
    this.clipboardEvents = pruneByTime(this.clipboardEvents, now - SAMPLE_RETENTION_MS)
  }

  private updateContinuousActive(active: boolean): void {
    if (active) {
      if (!this.continuousActiveStart) {
        this.continuousActiveStart = Date.now()
      }
    } else if (idleService.getIdleMs() >= 60_000) {
      this.continuousActiveStart = null
    }
  }

  private installInputHooks(): void {
    if (this.hooksInstalled || process.platform !== 'win32') {
      return
    }
    try {
      const WH_KEYBOARD_LL = 13
      const WH_MOUSE_LL = 14
      const HC_ACTION = 0
      const WM_MOUSEMOVE = 0x0200

      const HookProc = koffi.proto('intptr_t HookProc(int nCode, uintptr_t wParam, intptr_t lParam)')
      const SetWindowsHookExW = user32.func(
        'void *SetWindowsHookExW(int idHook, HookProc *lpfn, void *hMod, uint32 dwThreadId)'
      )
      const CallNextHookEx = user32.func(
        'intptr_t CallNextHookEx(void *hhk, int nCode, uintptr_t wParam, intptr_t lParam)'
      )
      const UnhookWindowsHookEx = user32.func('bool UnhookWindowsHookEx(void *hhk)')
      const kernel32 = koffi.load('kernel32.dll')
      const GetModuleHandleW = kernel32.func('void *GetModuleHandleW(str16 lpModuleName)')

      let keyboardHook: unknown = null
      let mouseHook: unknown = null
      let lastMouseMoveAt = 0

      const keyboardProc = koffi.register((nCode: number, wParam: number, lParam: number) => {
        if (nCode >= HC_ACTION) {
          const now = Date.now()
          this.inputEvents.push({ at: now, type: 'keyboard' })
          this.keyboardHookCount++
          this.markUserInput()
          this.updateContinuousActive(true)
        }
        return CallNextHookEx(keyboardHook, nCode, wParam, lParam)
      }, koffi.pointer(HookProc))

      const mouseProc = koffi.register((nCode: number, wParam: number, lParam: number) => {
        if (nCode >= HC_ACTION && wParam !== WM_MOUSEMOVE) {
          const now = Date.now()
          this.inputEvents.push({ at: now, type: 'mouse' })
          this.mouseHookCount++
          this.markUserInput()
          this.updateContinuousActive(true)
        } else if (nCode >= HC_ACTION && wParam === WM_MOUSEMOVE) {
          const now = Date.now()
          if (now - lastMouseMoveAt >= 200) {
            lastMouseMoveAt = now
            this.inputEvents.push({ at: now, type: 'mouse' })
            this.mouseHookCount++
            this.markUserInput()
            this.updateContinuousActive(true)
          }
        }
        return CallNextHookEx(mouseHook, nCode, wParam, lParam)
      }, koffi.pointer(HookProc))

      const hMod = GetModuleHandleW(null)
      keyboardHook = SetWindowsHookExW(WH_KEYBOARD_LL, keyboardProc, hMod, 0)
      mouseHook = SetWindowsHookExW(WH_MOUSE_LL, mouseProc, hMod, 0)

      if (keyboardHook && mouseHook) {
        this.hooksInstalled = true
        ;(this as { _keyboardHook?: unknown; _mouseHook?: unknown; _unhook?: () => void })._keyboardHook =
          keyboardHook
        ;(this as { _keyboardHook?: unknown; _mouseHook?: unknown; _unhook?: () => void })._mouseHook =
          mouseHook
        ;(this as { _keyboardHook?: unknown; _mouseHook?: unknown; _unhook?: () => void })._unhook = () => {
          if (keyboardHook) UnhookWindowsHookEx(keyboardHook)
          if (mouseHook) UnhookWindowsHookEx(mouseHook)
          koffi.unregister(keyboardProc)
          koffi.unregister(mouseProc)
        }
      }
    } catch {
      this.hooksInstalled = false
    }
  }

  private uninstallInputHooks(): void {
    const self = this as { _unhook?: () => void }
    self._unhook?.()
    self._unhook = undefined
    this.hooksInstalled = false
  }
}

export const activityMonitorService = new ActivityMonitorService()
