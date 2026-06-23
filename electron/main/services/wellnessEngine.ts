import type {
  ActivitySnapshot,
  SessionStatus,
  WellnessBodyTier,
  WellnessHudMode,
  WellnessHudStatus,
  WorkState
} from '../types/session'

const MENTAL_OOM_SWITCHES = 30
const MENTAL_OOM_APPS = 3
const PHASE_BREAK_IDLE_MS = 60_000
const PHASE_BREAK_PRIOR_SWITCHES = 8
const BREATHING_IDLE_MIN_MS = 5_000
const BREATHING_IDLE_MAX_MS = 60_000

function calcBodyProgress(session: SessionStatus): { progress: number; tier: WellnessBodyTier } {
  if (session.state === 'offDuty' || session.state === 'away' || session.isPaused) {
    return { progress: 0, tier: 'neutral' }
  }
  if (session.state === 'standing') {
    const total = session.standTimerTotalMs ?? session.standIntervalMinutes * 60_000
    const ratio = total > 0 ? 1 - session.timerRemainingMs / total : 0
    return { progress: Math.min(1, Math.max(0, ratio)), tier: 'green' }
  }
  if (session.state !== 'sitting' || session.timerMode !== 'sit') {
    return { progress: 0, tier: 'neutral' }
  }
  const total = session.sitIntervalMinutes * 60_000
  const elapsed = total > 0 ? 1 - session.timerRemainingMs / total : 0
  const progress = Math.min(1, Math.max(0, elapsed))
  let tier: WellnessBodyTier = 'green'
  if (progress >= 0.85) {
    tier = 'orange'
  } else if (progress >= 0.6) {
    tier = 'yellow'
  }
  return { progress, tier }
}

function calcMindLoad(activity: ActivitySnapshot): number {
  const switchScore = Math.min(100, (activity.windowSwitches5m / MENTAL_OOM_SWITCHES) * 85)
  const clipScore = Math.min(25, activity.clipboardOps5m * 2)
  const mouseBurst = activity.mousePerMinute >= 40 ? 15 : activity.mousePerMinute >= 25 ? 8 : 0
  return Math.min(100, Math.round(switchScore + clipScore + mouseBurst))
}

function isMentalOom(activity: ActivitySnapshot): boolean {
  return (
    activity.windowSwitches5m >= MENTAL_OOM_SWITCHES &&
    activity.distinctApps5m >= MENTAL_OOM_APPS
  )
}

function isBreathingGap(activity: ActivitySnapshot, session: SessionStatus): boolean {
  if (session.state !== 'sitting' || session.isPaused) {
    return false
  }
  const idle = activity.idleMs
  if (idle < BREATHING_IDLE_MIN_MS || idle >= BREATHING_IDLE_MAX_MS) {
    return false
  }
  if (activity.keyboardEvents15s >= 3) {
    return false
  }
  const hadRecentWork =
    activity.continuousActiveMinutes > 0 ||
    activity.windowSwitches5m >= 3 ||
    activity.keyboardPerMinute > 0
  if (!hadRecentWork) {
    return false
  }
  return activity.mousePerMinute >= 2 || idle >= 8_000
}

function isPhaseBreak(activity: ActivitySnapshot, session: SessionStatus): boolean {
  if (session.state !== 'sitting' || session.isPaused) {
    return false
  }
  if (activity.idleMs < PHASE_BREAK_IDLE_MS) {
    return false
  }
  return activity.windowSwitches10m >= PHASE_BREAK_PRIOR_SWITCHES
}

function resolveMode(activity: ActivitySnapshot, session: SessionStatus): WellnessHudMode {
  if (session.state === 'offDuty') {
    return 'off_duty'
  }
  if (isMentalOom(activity)) {
    return 'mental_oom'
  }
  if (isPhaseBreak(activity, session)) {
    return 'phase_break'
  }
  if (isBreathingGap(activity, session)) {
    return 'breathing'
  }
  return 'normal'
}

function resolveStatusLabel(session: SessionStatus): string {
  if (session.pauseReasonLabel) {
    return session.pauseReasonLabel
  }
  if (session.standReasonLabel && session.state === 'standing') {
    return session.standReasonLabel
  }
  if (session.isPaused || session.state === 'paused') {
    return '已暂停'
  }
  if (session.isInactivePaused && session.state === 'sitting') {
    return '输入暂停'
  }
  const LABEL: Record<WorkState, string> = {
    offDuty: '未上班',
    sitting: '久坐中',
    standing: '休息中',
    away: '离座中',
    paused: '已暂停'
  }
  return LABEL[session.state]
}

function resolveAction(
  mode: WellnessHudMode,
  session: SessionStatus,
  bodyTier: WellnessBodyTier
): { text: string; detail: string } {
  switch (mode) {
    case 'off_duty':
      return { text: '未上班', detail: '点击开始追踪' }
    case 'mental_oom':
      return { text: '线程交织过载', detail: '建议闭眼 30 秒' }
    case 'breathing':
      return { text: '等待间隙', detail: '跟着光圈深呼吸' }
    case 'phase_break':
      return { text: '阶段任务已清', detail: '顺势站立 1 分钟' }
    default:
      break
  }

  if (session.isPaused || session.state === 'paused') {
    return { text: '提醒已暂停', detail: session.pauseReasonLabel ?? '计时冻结' }
  }
  if (session.state === 'standing') {
    return { text: '站立休息', detail: '活动一下再坐下' }
  }
  if (session.state === 'away') {
    return { text: '离座中', detail: '计时已冻结' }
  }
  if (session.state === 'sitting' && session.isInactivePaused) {
    return { text: '输入暂停', detail: '久坐倒计时已冻结' }
  }
  if (bodyTier === 'orange') {
    return { text: '该站起来了', detail: '换脑拉伸' }
  }
  if (bodyTier === 'yellow') {
    return { text: '临近提醒', detail: '换脑拉伸' }
  }
  if (session.timerMode === 'sit' && session.timerRemainingMs > 0) {
    return { text: '坐姿时间', detail: '保持专注' }
  }
  return { text: 'standUp', detail: '健康伴侣' }
}

export function buildWellnessHudStatus(
  session: SessionStatus,
  activity: ActivitySnapshot,
  mindWaveform: number[]
): WellnessHudStatus {
  const { progress, tier } = calcBodyProgress(session)
  const mode = resolveMode(activity, session)
  const mindLoad = calcMindLoad(activity)
  const action = resolveAction(mode, session, tier)

  let countdownMs = 0
  if (
    mode === 'normal' &&
    (session.state === 'sitting' || session.state === 'standing') &&
    session.timerMode !== 'none' &&
    !session.isPaused
  ) {
    countdownMs = session.timerRemainingMs
  }

  return {
    mode,
    bodyProgress: progress,
    bodyTier: tier,
    mindLoad,
    mindWaveform,
    actionText: action.text,
    actionDetail: action.detail,
    countdownMs,
    windowSwitches5m: activity.windowSwitches5m,
    distinctApps5m: activity.distinctApps5m,
    clipboardOps5m: activity.clipboardOps5m,
    foregroundLabel: activity.foregroundLabel,
    statusLabel: resolveStatusLabel(session),
    workState: session.state
  }
}
