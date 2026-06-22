import { getForegroundIdeLabel } from './ideGuardService'
import { isBrowserProcess } from '../utils/browserTitleParser'
import type {
  ActivitySnapshot,
  DailyStats,
  HealthMetrics,
  NeckRiskLevel,
  WorkFocusState
} from '../types/session'

const IDE_PROCESSES = new Set([
  'code.exe',
  'cursor.exe',
  'devenv.exe',
  'webstorm64.exe',
  'idea64.exe',
  'pycharm64.exe',
  'pycharm.exe',
  'rider64.exe'
])

const WORK_FOCUS_LABELS: Record<WorkFocusState, string> = {
  deep_focus: '深度工作',
  fragmented: '碎片多任务',
  research: '资料查阅',
  low_focus: '低专注',
  neutral: '一般状态'
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

function isIdeProcess(processName: string | null): boolean {
  if (!processName) return false
  return IDE_PROCESSES.has(processName.toLowerCase())
}

function isBrowserProcessName(processName: string | null): boolean {
  return isBrowserProcess(processName)
}

export function detectWorkFocusState(
  activity: ActivitySnapshot,
  recentSwitchApps: string[]
): WorkFocusState {
  if (!activity.isInputActive && activity.continuousActiveMinutes <= 0) {
    return 'neutral'
  }

  if (activity.windowSwitches10m >= 15) {
    return 'fragmented'
  }

  const hasBrowser = recentSwitchApps.some((app) => isBrowserProcess(app))
  const hasIde = recentSwitchApps.some((app) => isIdeProcess(app))
  if (
    hasBrowser &&
    hasIde &&
    activity.windowSwitches10m >= 5 &&
    activity.windowSwitches10m < 15
  ) {
    return 'research'
  }

  if (
    activity.appCategory === 'entertainment' ||
    (activity.appCategory === 'social' && activity.continuousActiveMinutes < 10)
  ) {
    return 'low_focus'
  }

  const inIde =
    isIdeProcess(activity.foregroundApp) || Boolean(getForegroundIdeLabel())
  if (
    inIde &&
    activity.continuousActiveMinutes >= 20 &&
    activity.windowSwitches10m < 3 &&
    activity.isInputActive
  ) {
    return 'deep_focus'
  }

  if (activity.appCategory === 'work' && activity.continuousActiveMinutes >= 15) {
    return 'deep_focus'
  }

  return 'neutral'
}

export function calcCervicalHealthScore(params: {
  activity: ActivitySnapshot
  daily: DailyStats
  healthMetrics: HealthMetrics
}): number {
  const { activity, daily, healthMetrics } = params
  let score = 100

  score -= Math.round(activity.staticWorkIndex * 0.45)
  score -= Math.min(25, Math.round(activity.continuousActiveMinutes * 0.35))

  const longestSitMinutes = Math.round(daily.longestSitMs / 60_000)
  score -= Math.min(20, longestSitMinutes * 0.25)

  score -= Math.min(15, (daily.snoozeCount || 0) * 3)
  score -= Math.min(10, (daily.reminderIgnoredCount || 0) * 4)

  score += Math.min(12, activity.microActionCountToday * 2)
  score += Math.min(15, healthMetrics.effectiveStandCount * 2)

  if (activity.neckRiskLevel === 'high') {
    score -= 8
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

function buildHighRiskPeriodHint(daily: DailyStats): string {
  const sittingSessions = daily.sessions.filter(
    (session) => (session.type ?? 'sitting') === 'sitting' && session.endAt
  )
  if (sittingSessions.length === 0) {
    return ''
  }

  let longest = sittingSessions[0]
  for (const session of sittingSessions) {
    const duration = (session.endAt || 0) - session.startAt
    const longestDuration = (longest.endAt || 0) - longest.startAt
    if (duration > longestDuration) {
      longest = session
    }
  }

  const durationMs = (longest.endAt || 0) - longest.startAt
  if (durationMs < 30 * 60_000) {
    return ''
  }

  const fmt = (ts: number) => {
    const date = new Date(ts)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  return `${fmt(longest.startAt)}~${fmt(longest.endAt!)}`
}

function buildHealthAdvice(params: {
  activity: ActivitySnapshot
  daily: DailyStats
  healthScore: number
  workFocusState: WorkFocusState
  sitIntervalMinutes: number
  currentSitMs: number
}): string {
  const {
    activity,
    daily,
    healthScore,
    workFocusState,
    sitIntervalMinutes,
    currentSitMs
  } = params

  const sitMinutes = Math.round(currentSitMs / 60_000)
  const thresholdMs = sitIntervalMinutes * 60_000

  if (activity.neckRiskLevel === 'high' || healthScore < 45) {
    return '颈椎已进入高风险区，建议立刻做 3 秒微动作或站起来活动 2 分钟。'
  }

  if (currentSitMs >= thresholdMs) {
    return '已达到起立阈值，起来活动一下吧。'
  }

  if (workFocusState === 'deep_focus' && activity.continuousActiveMinutes >= 25) {
    return `深度专注已 ${activity.continuousActiveMinutes} 分钟，转一下脖子再继续。`
  }

  if (workFocusState === 'fragmented') {
    return '切换窗口较频繁，眼睛和颈椎都需要短暂放松。'
  }

  if (workFocusState === 'research') {
    return '资料查阅模式，记得每隔一段时间让颈椎离开固定角度。'
  }

  if ((daily.snoozeCount || 0) >= 2) {
    return '今日多次推迟提醒，久坐风险在累积，下次试试先站起来。'
  }

  if (healthScore >= 80) {
    return '当前节奏良好，保持微动作和定时起立即可。'
  }

  if (sitMinutes >= Math.max(20, sitIntervalMinutes - 10)) {
    const remain = Math.max(1, sitIntervalMinutes - sitMinutes)
    return `预计 ${remain} 分钟后达到起立提醒，可以提前活动肩颈。`
  }

  return '保持键鼠活跃间隙的微动作，比一次长休息更护颈椎。'
}

function estimateFatigueMinutes(activity: ActivitySnapshot, sitIntervalMinutes: number): number | null {
  if (!activity.isInputActive) {
    return null
  }
  if (activity.neckRiskLevel === 'high') {
    return 0
  }

  const fatigueScore =
    activity.staticWorkIndex * 0.5 +
    activity.continuousActiveMinutes * 1.2 +
    (activity.mouseRangeWidth < 400 && activity.mouseRangeHeight < 300 ? 15 : 0)

  const threshold = 55 + sitIntervalMinutes * 0.3
  const remaining = Math.round((threshold - fatigueScore) / 1.5)
  return Math.max(0, Math.min(120, remaining))
}

export function buildDailyHealthSummary(params: {
  activity: ActivitySnapshot
  daily: DailyStats
  healthMetrics: HealthMetrics
  sitIntervalMinutes: number
  currentSitMs: number
  recentSwitchApps: string[]
}): DailyHealthSummary {
  const { activity, daily, healthMetrics, sitIntervalMinutes, currentSitMs, recentSwitchApps } =
    params

  const cervicalHealthScore = calcCervicalHealthScore({ activity, daily, healthMetrics })
  const workFocusState = detectWorkFocusState(activity, recentSwitchApps)
  const highRiskPeriodHint = buildHighRiskPeriodHint(daily)
  const healthAdvice = buildHealthAdvice({
    activity,
    daily,
    healthScore: cervicalHealthScore,
    workFocusState,
    sitIntervalMinutes,
    currentSitMs
  })

  let neckRiskLevel = activity.neckRiskLevel
  if (cervicalHealthScore < 45) {
    neckRiskLevel = 'high'
  } else if (cervicalHealthScore < 70 && neckRiskLevel === 'low') {
    neckRiskLevel = 'medium'
  }

  return {
    cervicalHealthScore,
    neckRiskLevel,
    workFocusState,
    workFocusLabel: WORK_FOCUS_LABELS[workFocusState],
    healthAdvice,
    fatigueEstimateMinutes: estimateFatigueMinutes(activity, sitIntervalMinutes),
    longestSitMs: daily.longestSitMs,
    currentContinuousSitMs: currentSitMs,
    microActionCountToday: activity.microActionCountToday,
    effectiveStandCount: healthMetrics.effectiveStandCount,
    continuousActiveMinutes: activity.continuousActiveMinutes,
    staticWorkIndex: activity.staticWorkIndex,
    highRiskPeriodHint,
    workMsToday: activity.workMsToday,
    entertainmentMsToday: activity.entertainmentMsToday,
    socialMsToday: activity.socialMsToday,
    foregroundLabel: activity.foregroundLabel
  }
}
