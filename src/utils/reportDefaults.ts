const DEFAULT_PROCRASTINATION = {
  todayRate: 0,
  todaySnoozeCount: 0,
  todayBreakCount: 0,
  weekRate: 0,
  prevWeekRate: 0,
  weekRateDelta: 0
}

const DEFAULT_HEALTH = {
  decompressionMinutes: 0,
  effectiveStandCount: 0,
  estimatedCalories: 0,
  calorieAnalogy: ''
}

const DEFAULT_EXECUTION = {
  triggeredCount: 0,
  onTimeCount: 0,
  delayedCount: 0,
  ignoredCount: 0,
  onTimeRate: 0
}

const DEFAULT_WORK = {
  activeWorkMs: 0,
  awayMs: 0,
  breakMs: 0,
  focusPeakStart: '',
  focusPeakEnd: '',
  focusPeakMessage: ''
}

export function createEmptyReportSummary(): import('@/types/session').ReportSummary {
  return {
    weekly: [],
    monthly: [],
    insight: null,
    insights: [],
    procrastination: { ...DEFAULT_PROCRASTINATION },
    healthMetrics: { ...DEFAULT_HEALTH },
    execution: { ...DEFAULT_EXECUTION },
    workMetrics: { ...DEFAULT_WORK },
    weekBreakTotal: 0,
    weekSitMs: 0,
    monthBreakTotal: 0,
    savedSitMs: 0,
    goalAchievementRate7: 0,
    goalAchievementRate30: 0,
    personalPercentile: 0,
    personalPercentileMessage: ''
  }
}
