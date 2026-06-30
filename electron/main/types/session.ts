export type WorkState = 'offDuty' | 'sitting' | 'standing' | 'away' | 'paused'

export type SessionType = 'sitting' | 'standing'

export type SessionEndReason =
  | 'reminder'
  | 'manual'
  | 'idle'
  | 'endWork'
  | 'snooze'
  | 'timeout'
  | 'auto_idle'

export type StandReasonId = 'water' | 'bathroom' | 'other' | 'lunch' | 'meeting'

export type TimerMode = 'sit' | 'stand' | 'none'

export interface PauseRecord {
  id: string
  reason: StandReasonId
  startAt: number
  endAt?: number
  plannedMinutes: number
}

export interface SnoozeEvent {
  at: number
  minutes: number
}

export interface WorkSession {
  id: string
  type: SessionType
  startAt: number
  endAt?: number
  endReason?: SessionEndReason
  standReason?: StandReasonId
}

export interface DailyStats {
  date: string
  workStartAt?: number
  totalSitMs: number
  totalStandMs: number
  breakCount: number
  longestSitMs: number
  snoozeCount: number
  snoozes: SnoozeEvent[]
  reminderTriggeredCount: number
  reminderOnTimeCount: number
  reminderDelayedCount: number
  reminderIgnoredCount: number
  sessions: WorkSession[]
  pauseRecords?: PauseRecord[]
  /** 未通过 session 间隙记录的离座时长（如下班时仍处于 away） */
  totalAwayMs?: number
}

export type AmbientDisplayMode = 'none' | 'statusBar' | 'desktopPet'

export type StatusBarEdge = 'top' | 'bottom' | 'left' | 'right'

export interface StatusBarPlacementOption {
  id: string
  displayId: number
  displayLabel: string
  edge: StatusBarEdge
  edgeLabel: string
  orientation: 'horizontal' | 'vertical'
  label: string
}

export interface StatusBarLayoutInfo {
  x: number
  y: number
  width: number
  height: number
  orientation: 'horizontal' | 'vertical'
  displayId: number
  edge: StatusBarEdge
}

export type AiProvider = 'openai' | 'deepseek' | 'custom'

export type AiAnalysisStatus = 'idle' | 'generating' | 'ready' | 'error'

export interface AiDailyAnalysis {
  date: string
  status: AiAnalysisStatus
  generatedAt?: number
  summary?: string
  highlights?: string[]
  suggestions?: string[]
  tomorrowTip?: string
  error?: string
}

export interface AppSettings {
  sitIntervalMinutes: number
  standIntervalMinutes: number
  idleThresholdMinutes: number
  launchAtLogin: boolean
  snoozeMinutes: number
  autoStandIdleMinutes: number
  /** 提醒激活期间，键鼠空闲达到该秒数即判定为已起身并解除提醒 */
  standUnlockIdleSeconds: number
  /** 起立模式下，检测键鼠活动的窗口（秒） */
  standSitDownDetectSeconds: number
  /** 起立模式下，窗口内鼠标活动次数达到该值则询问是否坐下 */
  standSitDownMouseEvents: number
  enableAutoStandOnIdle: boolean
  enableSitDownPrompt: boolean
  dailyBreakGoal: number
  toastGraceSeconds: number
  overlayGraceSeconds: number
  enableIdeGuard: boolean
  ideActiveThresholdSeconds: number
  autoDndFullscreen: boolean
  workStartTime: string
  workEndTime: string
  enableWorkSchedule: boolean
  enableHolidayRest: boolean
  scheduleGraceSeconds: number
  inactivePauseMinutes: number
  ambientDisplayMode: AmbientDisplayMode
  statusBarDisplayId: number
  statusBarEdge: StatusBarEdge
  enableActivityMonitor: boolean
  enableMicroActionReminders: boolean
  microActionIntervalMinutes: number
  enableEntertainmentSoftReminder: boolean
  enableAiDailyAnalysis: boolean
  aiProvider: AiProvider
  aiApiKey: string
  aiBaseUrl: string
  aiModel: string
  aiTriggerOnWorkEnd: boolean
  aiIncludeAppNames: boolean
  appCategoryOverrides: Record<string, AppCategory>
}

export interface RangeDayStat {
  date: string
  label: string
  breakCount: number
  totalSitMs: number
  goalMet: boolean
}

export type WeeklyDayStat = RangeDayStat

export interface SittingInsight {
  peakStart: string
  peakEnd: string
  message: string
}

export type InsightKind =
  | 'peak_sitting'
  | 'procrastination'
  | 'goal'
  | 'health'
  | 'focus'
  | 'encourage'
  | 'activity'

export type NeckRiskLevel = 'low' | 'medium' | 'high'

export type AppCategory = 'work' | 'entertainment' | 'social' | 'neutral'

export type WorkFocusState = 'deep_focus' | 'fragmented' | 'research' | 'low_focus' | 'neutral'

export interface AppCategoryConfigItem {
  processName: string
  label: string
  defaultCategory: AppCategory
  effectiveCategory: AppCategory
  isOverridden: boolean
  source: 'builtin' | 'observed'
  isBrowser: boolean
  categoryEditable: boolean
}

export interface AppUsageSegment {
  id: string
  processName: string
  label: string
  category: AppCategory
  windowTitle?: string
  siteKey?: string
  siteLabel?: string
  startAt: number
  endAt?: number
}

export interface AppUsageAppTotal {
  processName: string
  label: string
  category: AppCategory
  durationMs: number
  isBrowser?: boolean
}

export interface AppUsageBrowserSiteTotal {
  processName: string
  siteKey: string
  siteLabel: string
  category: AppCategory
  durationMs: number
}

export interface AppUsageCategoryTotal {
  category: AppCategory
  label: string
  durationMs: number
}

export interface AppUsageHourlyBucket {
  hour: number
  label: string
  workMs: number
  entertainmentMs: number
  socialMs: number
  neutralMs: number
}

export interface AppUsageDailySummary {
  date: string
  segments: AppUsageSegment[]
  appTotals: AppUsageAppTotal[]
  categoryTotals: AppUsageCategoryTotal[]
  hourlyBuckets: AppUsageHourlyBucket[]
  browserSiteTotals: AppUsageBrowserSiteTotal[]
  totalTrackedMs: number
}

export interface ActivitySnapshot {
  foregroundApp: string | null
  foregroundLabel: string | null
  windowTitle: string | null
  appCategory: AppCategory
  keyboardPerMinute: number
  mousePerMinute: number
  mouseRangeWidth: number
  mouseRangeHeight: number
  windowSwitches10m: number
  windowSwitches5m: number
  distinctApps5m: number
  clipboardOps5m: number
  keyboardEvents15s: number
  continuousActiveMinutes: number
  staticWorkIndex: number
  neckRiskLevel: NeckRiskLevel
  workMsToday: number
  entertainmentMsToday: number
  socialMsToday: number
  microActionCountToday: number
  isInputActive: boolean
  idleMs: number
}

export type WellnessHudMode = 'off_duty' | 'normal' | 'mental_oom' | 'breathing' | 'phase_break'

export type WellnessBodyTier = 'neutral' | 'green' | 'yellow' | 'orange'

export interface WellnessHudStatus {
  mode: WellnessHudMode
  bodyProgress: number
  bodyTier: WellnessBodyTier
  mindLoad: number
  mindWaveform: number[]
  actionText: string
  actionDetail: string
  countdownMs: number
  windowSwitches5m: number
  distinctApps5m: number
  clipboardOps5m: number
  foregroundLabel: string | null
  statusLabel: string
  workState: WorkState
}

export interface DailyHealthSummary {
  cervicalHealthScore: number
  neckRiskLevel: NeckRiskLevel
  workFocusState: WorkFocusState
  workFocusLabel: string
  healthAdvice: string
  fatigueEstimateMinutes: number | null
  longestSitMs: number
  currentContinuousSitMs: number
  microActionCountToday: number
  effectiveStandCount: number
  continuousActiveMinutes: number
  staticWorkIndex: number
  highRiskPeriodHint: string
  workMsToday: number
  entertainmentMsToday: number
  socialMsToday: number
  foregroundLabel: string | null
}

export interface ActionableInsight {
  id: string
  kind: InsightKind
  message: string
  priority: number
}

export interface ProcrastinationStats {
  todayRate: number
  todaySnoozeCount: number
  todayBreakCount: number
  weekRate: number
  prevWeekRate: number
  weekRateDelta: number
}

export interface HealthMetrics {
  decompressionMinutes: number
  effectiveStandCount: number
  estimatedCalories: number
  calorieAnalogy: string
}

export interface ExecutionStats {
  triggeredCount: number
  onTimeCount: number
  delayedCount: number
  ignoredCount: number
  onTimeRate: number
}

export interface WorkMetrics {
  activeWorkMs: number
  awayMs: number
  breakMs: number
  focusPeakStart: string
  focusPeakEnd: string
  focusPeakMessage: string
}

export interface ReportSummary {
  weekly: RangeDayStat[]
  monthly: RangeDayStat[]
  insight: SittingInsight | null
  insights: ActionableInsight[]
  procrastination: ProcrastinationStats
  healthMetrics: HealthMetrics
  execution: ExecutionStats
  workMetrics: WorkMetrics
  weekBreakTotal: number
  weekSitMs: number
  monthBreakTotal: number
  savedSitMs: number
  goalAchievementRate7: number
  goalAchievementRate30: number
  personalPercentile: number
  personalPercentileMessage: string
}

export interface GamificationState {
  growthPoints: number
  level: number
  streakDays: number
  lastBreakDate: string
  totalBreaks: number
}

export interface PersistedRuntime {
  state: WorkState
  currentSessionId?: string
  currentSessionType?: SessionType
  sessionAccumulatedMs?: number
  segmentStartAt?: number
  sitDeadlineAt?: number
  standDeadlineAt?: number
  pausedBeforeState?: WorkState
  pausedUntil?: number
  awayEnteredAt?: number
  awaySitEndAt?: number
  pauseReason?: StandReasonId
  /** @deprecated */
  currentSessionStartAt?: number
  /** @deprecated */
  timerDeadlineAt?: number
}

export interface ReminderCopyPayload {
  title: string
  subtitle: string
  tag: string
}

export interface ReminderIdleProgress {
  idleSeconds: number
  requiredSeconds: number
  remainingSeconds: number
  progress: number
  unlocked: boolean
}

export interface SessionStatus {
  state: WorkState
  currentSitMs: number
  currentStandMs: number
  timerRemainingMs: number
  timerMode: TimerMode
  sitIntervalMinutes: number
  standIntervalMinutes: number
  isPaused: boolean
  pausedUntil?: number
  isInactivePaused?: boolean
  standReasonLabel?: string
  pauseReasonLabel?: string
  standTimerTotalMs?: number
  pauseTimerTotalMs?: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  sitIntervalMinutes: 40,
  standIntervalMinutes: 5,
  idleThresholdMinutes: 5,
  launchAtLogin: false,
  snoozeMinutes: 10,
  autoStandIdleMinutes: 2,
  standUnlockIdleSeconds: 30,
  standSitDownDetectSeconds: 60,
  standSitDownMouseEvents: 5,
  enableAutoStandOnIdle: true,
  enableSitDownPrompt: true,
  dailyBreakGoal: 8,
  toastGraceSeconds: 8,
  overlayGraceSeconds: 30,
  enableIdeGuard: true,
  ideActiveThresholdSeconds: 120,
  autoDndFullscreen: false,
  workStartTime: '09:00',
  workEndTime: '18:00',
  enableWorkSchedule: true,
  enableHolidayRest: true,
  scheduleGraceSeconds: 60,
  inactivePauseMinutes: 3,
  ambientDisplayMode: 'none',
  statusBarDisplayId: 0,
  statusBarEdge: 'top',
  enableActivityMonitor: true,
  enableMicroActionReminders: true,
  microActionIntervalMinutes: 15,
  enableEntertainmentSoftReminder: true,
  enableAiDailyAnalysis: false,
  aiProvider: 'deepseek',
  aiApiKey: '',
  aiBaseUrl: '',
  aiModel: '',
  aiTriggerOnWorkEnd: true,
  aiIncludeAppNames: false,
  appCategoryOverrides: {}
}

export const SAVED_MS_PER_BREAK = 2 * 60_000
