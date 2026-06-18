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

export type TimerMode = 'sit' | 'stand' | 'none'

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
  sessions: WorkSession[]
}

export interface AppSettings {
  sitIntervalMinutes: number
  standIntervalMinutes: number
  idleThresholdMinutes: number
  launchAtLogin: boolean
  snoozeMinutes: number
  autoStandIdleMinutes: number
  dailyBreakGoal: number
  toastGraceSeconds: number
  autoDndFullscreen: boolean
  workStartTime: string
  workEndTime: string
  enableWorkSchedule: boolean
  enableHolidayRest: boolean
  scheduleGraceSeconds: number
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

export interface ReportSummary {
  weekly: RangeDayStat[]
  monthly: RangeDayStat[]
  insight: SittingInsight | null
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
  currentSessionStartAt?: number
  timerDeadlineAt?: number
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
}

export const DEFAULT_SETTINGS: AppSettings = {
  sitIntervalMinutes: 40,
  standIntervalMinutes: 5,
  idleThresholdMinutes: 5,
  launchAtLogin: false,
  snoozeMinutes: 10,
  autoStandIdleMinutes: 2,
  dailyBreakGoal: 8,
  toastGraceSeconds: 60,
  autoDndFullscreen: false,
  workStartTime: '09:00',
  workEndTime: '18:00',
  enableWorkSchedule: true,
  enableHolidayRest: true,
  scheduleGraceSeconds: 60
}

export const SAVED_MS_PER_BREAK = 2 * 60_000
