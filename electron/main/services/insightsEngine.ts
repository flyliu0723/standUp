import type {
  ActionableInsight,
  ActivitySnapshot,
  DailyStats,
  ExecutionStats,
  HealthMetrics,
  ProcrastinationStats,
  SittingInsight,
  SnoozeEvent,
  WorkMetrics
} from '../types/session'

const EFFECTIVE_STAND_MS = 2 * 60_000
const CALORIES_PER_STAND_MINUTE = 0.8

function calcAwayMsFromSessions(daily: DailyStats): number {
  const sessions = [...daily.sessions].sort((a, b) => a.startAt - b.startAt)
  let awayMs = daily.totalAwayMs || 0
  for (let i = 1; i < sessions.length; i++) {
    const prev = sessions[i - 1]
    const curr = sessions[i]
    if (!prev.endAt) continue
    const gap = curr.startAt - prev.endAt
    if (gap >= 60_000 && prev.endReason === 'idle') {
      awayMs += gap
    }
  }
  return awayMs
}

function calcRate(snooze: number, breaks: number): number {
  const total = snooze + breaks
  return total === 0 ? 0 : Math.round((snooze / total) * 100)
}

function formatCalorieAnalogy(calories: number): string {
  if (calories <= 0) return ''
  if (calories < 50) return `${calories} 大卡`
  if (calories < 150) return `${calories} 大卡，相当于少喝半罐可乐`
  return `${calories} 大卡，相当于少喝一罐可乐`
}

export function calcHealthMetrics(daily: DailyStats): HealthMetrics {
  const standingSessions = daily.sessions.filter(
    (s) => (s.type ?? 'sitting') === 'standing' && s.endAt
  )
  let effectiveStandCount = 0
  let decompressionMs = 0

  for (const s of standingSessions) {
    const dur = s.endAt! - s.startAt
    if (dur >= EFFECTIVE_STAND_MS) {
      effectiveStandCount++
      decompressionMs += dur
    }
  }

  if (decompressionMs === 0 && daily.totalStandMs > 0) {
    decompressionMs = daily.totalStandMs
    effectiveStandCount = Math.max(effectiveStandCount, daily.breakCount)
  }

  const decompressionMinutes = Math.round(decompressionMs / 60_000)
  const estimatedCalories = Math.round((decompressionMs / 60_000) * CALORIES_PER_STAND_MINUTE)

  return {
    decompressionMinutes,
    effectiveStandCount,
    estimatedCalories,
    calorieAnalogy: formatCalorieAnalogy(estimatedCalories)
  }
}

export function calcWorkMetrics(daily: DailyStats): import('../types/session').WorkMetrics {
  const awayMs = calcAwayMsFromSessions(daily)
  const breakMs = daily.totalStandMs || 0
  const activeWorkMs = Math.max(0, daily.totalSitMs)

  const focusEvents: { at: number }[] = [
    ...(daily.snoozes || []).map((s) => ({ at: s.at })),
    ...daily.sessions
      .filter((s) => s.endReason === 'snooze')
      .map((s) => ({ at: s.endAt || s.startAt }))
  ]

  let focusPeakStart = ''
  let focusPeakEnd = ''
  let focusPeakMessage = ''

  if (focusEvents.length >= 2) {
    const buckets = new Array(24).fill(0) as number[]
    for (const e of focusEvents) {
      buckets[new Date(e.at).getHours()]++
    }
    let peakHour = 0
    let peakCount = 0
    buckets.forEach((count, hour) => {
      if (count > peakCount) {
        peakCount = count
        peakHour = hour
      }
    })
    if (peakCount >= 2) {
      const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`
      focusPeakStart = fmt(peakHour)
      focusPeakEnd = fmt(Math.min(23, peakHour + 1))
      focusPeakMessage = `你在 ${focusPeakStart} - ${focusPeakEnd} 常推迟或暂停，可能是深度专注时段。`
    }
  }

  return {
    activeWorkMs,
    awayMs,
    breakMs,
    focusPeakStart,
    focusPeakEnd,
    focusPeakMessage
  }
}

export function calcExecutionStats(daily: DailyStats): ExecutionStats {
  const onTime = daily.reminderOnTimeCount || 0
  const delayed = daily.reminderDelayedCount || 0
  const ignored = daily.reminderIgnoredCount || 0
  const responded = onTime + delayed
  return {
    triggeredCount: daily.reminderTriggeredCount || 0,
    onTimeCount: onTime,
    delayedCount: delayed,
    ignoredCount: ignored,
    onTimeRate: responded > 0 ? Math.round((onTime / responded) * 100) : 0
  }
}

export function calcProcrastinationStats(
  today: DailyStats,
  weekDailies: DailyStats[],
  prevWeekDailies: DailyStats[]
): ProcrastinationStats {
  const weekSnooze = weekDailies.reduce((s, d) => s + (d.snoozeCount || 0), 0)
  const weekBreaks = weekDailies.reduce((s, d) => s + d.breakCount, 0)
  const prevSnooze = prevWeekDailies.reduce((s, d) => s + (d.snoozeCount || 0), 0)
  const prevBreaks = prevWeekDailies.reduce((s, d) => s + d.breakCount, 0)
  const weekRate = calcRate(weekSnooze, weekBreaks)
  const prevWeekRate = calcRate(prevSnooze, prevBreaks)

  return {
    todayRate: calcRate(today.snoozeCount || 0, today.breakCount),
    todaySnoozeCount: today.snoozeCount || 0,
    todayBreakCount: today.breakCount,
    weekRate,
    prevWeekRate,
    weekRateDelta: weekRate - prevWeekRate
  }
}

export function analyzeSnoozePeakHour(
  snoozes: SnoozeEvent[]
): { peakStart: string; peakEnd: string } | null {
  if (snoozes.length < 2) return null

  const buckets = new Array(24).fill(0) as number[]
  for (const s of snoozes) {
    buckets[new Date(s.at).getHours()]++
  }

  let peakHour = 0
  let peakCount = 0
  buckets.forEach((count, hour) => {
    if (count > peakCount) {
      peakCount = count
      peakHour = hour
    }
  })

  if (peakCount < 2) return null

  const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`
  return { peakStart: fmt(peakHour), peakEnd: fmt(peakHour + 1) }
}

export function generateInsights(params: {
  daily: DailyStats
  peakSitting: SittingInsight | null
  procrastination: ProcrastinationStats
  health: HealthMetrics
  execution: ExecutionStats
  workMetrics: WorkMetrics
  goalRate7: number
  personalMessage: string
  activity?: ActivitySnapshot | null
}): ActionableInsight[] {
  const insights: ActionableInsight[] = []

  const activity = params.activity
  if (activity && activity.neckRiskLevel === 'high') {
    insights.push({
      id: 'neck-risk-high',
      kind: 'activity',
      message: `静止工作指数 ${activity.staticWorkIndex}：已连续活跃 ${activity.continuousActiveMinutes} 分钟，鼠标活动范围仅 ${activity.mouseRangeWidth}×${activity.mouseRangeHeight}px，颈椎风险较高。`,
      priority: 95
    })
  } else if (activity && activity.neckRiskLevel === 'medium') {
    insights.push({
      id: 'neck-risk-medium',
      kind: 'activity',
      message: `已连续活跃 ${activity.continuousActiveMinutes} 分钟，建议做 3 秒微动作（转头/耸肩）放松颈椎。`,
      priority: 82
    })
  }

  if (activity && activity.entertainmentMsToday > activity.workMsToday && activity.entertainmentMsToday > 30 * 60_000) {
    const entHours = (activity.entertainmentMsToday / 3_600_000).toFixed(1)
    insights.push({
      id: 'entertainment-heavy',
      kind: 'activity',
      message: `今日娱乐应用约 ${entHours} 小时，记得同样活动脖子和肩膀。`,
      priority: 72
    })
  }

  if (activity && activity.mouseRangeWidth > 0 && activity.mouseRangeWidth < 400 && activity.mouseRangeHeight < 300) {
    insights.push({
      id: 'mouse-range-small',
      kind: 'activity',
      message: `近 10 分钟鼠标活动范围 ${activity.mouseRangeWidth}×${activity.mouseRangeHeight}px，可能在盯固定区域，试试远眺或扩胸。`,
      priority: 68
    })
  }

  if (activity && activity.socialMsToday > 45 * 60_000) {
    const socialHours = (activity.socialMsToday / 3_600_000).toFixed(1)
    insights.push({
      id: 'social-heavy',
      kind: 'activity',
      message: `今日社交应用约 ${socialHours} 小时，聊天同样容易长时间低头，记得间歇活动颈椎。`,
      priority: 70
    })
  }

  if (activity && activity.windowSwitches10m >= 15) {
    insights.push({
      id: 'work-fragmented',
      kind: 'focus',
      message: `近 10 分钟切换窗口 ${activity.windowSwitches10m} 次，处于碎片多任务状态，建议集中处理一件事再切下一个。`,
      priority: 74
    })
  } else if (activity && activity.windowSwitches10m >= 8) {
    insights.push({
      id: 'window-switching',
      kind: 'activity',
      message: `近 10 分钟切换窗口 ${activity.windowSwitches10m} 次，多任务频繁，注意间歇放松眼睛。`,
      priority: 58
    })
  }

  if (params.peakSitting) {
    insights.push({
      id: 'peak-sitting',
      kind: 'peak_sitting',
      message: params.peakSitting.message,
      priority: 70
    })
  }

  const snoozePeak = analyzeSnoozePeakHour(params.daily.snoozes || [])
  if (snoozePeak) {
    insights.push({
      id: 'focus-peak',
      kind: 'focus',
      message: `你在 ${snoozePeak.peakStart} - ${snoozePeak.peakEnd} 常推迟提醒，可能是深度专注时段，建议该时段开启免打扰。`,
      priority: 80
    })
  } else if (params.workMetrics.focusPeakMessage) {
    insights.push({
      id: 'focus-peak-combined',
      kind: 'focus',
      message: params.workMetrics.focusPeakMessage,
      priority: 78
    })
  }

  if (params.workMetrics.activeWorkMs > 0) {
    const hours = (params.workMetrics.activeWorkMs / 3_600_000).toFixed(1)
    insights.push({
      id: 'work-active',
      kind: 'encourage',
      message: `今日有效搬砖约 ${hours} 小时，离座 ${Math.round(params.workMetrics.awayMs / 60_000)} 分钟，休息 ${Math.round(params.workMetrics.breakMs / 60_000)} 分钟。`,
      priority: 52
    })
  }

  const { todayRate, todaySnoozeCount, weekRateDelta } = params.procrastination
  const { onTimeCount, delayedCount, ignoredCount, onTimeRate } = params.execution

  if (params.execution.triggeredCount > 0) {
    insights.push({
      id: 'execution-summary',
      kind: 'procrastination',
      message: `今日提醒 ${params.execution.triggeredCount} 次：按时 ${onTimeCount} · 延迟 ${delayedCount} · 忽略 ${ignoredCount}，按时率 ${onTimeRate}%。`,
      priority: 88
    })
  }

  if (ignoredCount >= 1) {
    insights.push({
      id: 'execution-ignored',
      kind: 'procrastination',
      message: `今日有 ${ignoredCount} 次提醒被忽略，久坐风险在累积，下次试试先站起来。`,
      priority: 92
    })
  }

  if (todaySnoozeCount >= 2) {
    insights.push({
      id: 'procrastination-today',
      kind: 'procrastination',
      message: `今日拖延指数 ${todayRate}%，已推迟提醒 ${todaySnoozeCount} 次，下次试试提醒后直接起立。`,
      priority: 90
    })
  }

  if (weekRateDelta !== 0 && params.procrastination.weekRate > 0) {
    if (weekRateDelta < 0) {
      insights.push({
        id: 'procrastination-improved',
        kind: 'procrastination',
        message: `本周拖延率比上周下降 ${Math.abs(weekRateDelta)}%，执行力在提升，继续保持！`,
        priority: 75
      })
    } else if (weekRateDelta > 5) {
      insights.push({
        id: 'procrastination-worse',
        kind: 'procrastination',
        message: `本周拖延率比上周上升 ${weekRateDelta}%，可以多关注提醒时的第一反应。`,
        priority: 85
      })
    }
  }

  if (params.health.effectiveStandCount > 0) {
    insights.push({
      id: 'health-decompression',
      kind: 'health',
      message: `今日有效起立 ${params.health.effectiveStandCount} 次，累计为腰椎减压约 ${params.health.decompressionMinutes} 分钟。`,
      priority: 60
    })
    if (params.health.estimatedCalories > 0) {
      insights.push({
        id: 'health-calories',
        kind: 'health',
        message: `今日站立额外消耗约 ${params.health.calorieAnalogy}。`,
        priority: 55
      })
    }
  }

  if (params.goalRate7 >= 80) {
    insights.push({
      id: 'goal-good',
      kind: 'goal',
      message: `近 7 日达标率 ${params.goalRate7}%，节奏稳定，身体在感谢你。`,
      priority: 50
    })
  } else if (params.goalRate7 > 0 && params.goalRate7 < 50) {
    insights.push({
      id: 'goal-low',
      kind: 'goal',
      message: `近 7 日达标率 ${params.goalRate7}%，可以把提醒间隔调短一些试试。`,
      priority: 65
    })
  }

  if (params.personalMessage) {
    insights.push({
      id: 'personal',
      kind: 'encourage',
      message: params.personalMessage,
      priority: 45
    })
  }

  if (insights.length === 0) {
    insights.push({
      id: 'default-tip',
      kind: 'encourage',
      message: '接杯水、眺望远处，眼睛和身体都需要短暂休息。',
      priority: 10
    })
  }

  return insights.sort((a, b) => b.priority - a.priority)
}
