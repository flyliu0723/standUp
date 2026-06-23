import type {
  AppSettings,
  AppUsageDailySummary,
  DailyStats,
  ReportSummary
} from '../types/session'

const CATEGORY_LABELS: Record<string, string> = {
  work: '工作',
  entertainment: '娱乐',
  social: '社交',
  neutral: '其他'
}

function roundMinutes(ms: number): number {
  return Math.round(ms / 60_000)
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

function formatTimeMs(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function findPeakSittingHours(daily: DailyStats): string[] {
  const buckets = new Array(24).fill(0) as number[]
  for (const session of daily.sessions) {
    if ((session.type ?? 'sitting') !== 'sitting' || !session.endAt) {
      continue
    }
    let cursor = new Date(session.startAt)
    const end = new Date(session.endAt)
    while (cursor < end) {
      const hour = cursor.getHours()
      const nextHour = new Date(cursor)
      nextHour.setHours(hour + 1, 0, 0, 0)
      const sliceEnd = nextHour < end ? nextHour : end
      buckets[hour] += sliceEnd.getTime() - cursor.getTime()
      cursor = sliceEnd
    }
  }

  const peakMs = Math.max(...buckets)
  if (peakMs < 20 * 60_000) {
    return []
  }

  return buckets
    .map((ms, hour) => ({ hour, ms }))
    .filter((item) => item.ms >= peakMs * 0.7)
    .map((item) => formatHourLabel(item.hour))
}

export function buildAiAnalysisPayload(params: {
  date: string
  daily: DailyStats
  report: ReportSummary
  appUsage: AppUsageDailySummary
  settings: Pick<AppSettings, 'sitIntervalMinutes' | 'dailyBreakGoal'>
  includeAppNames: boolean
}): Record<string, unknown> {
  const { date, daily, report, appUsage, settings, includeAppNames } = params
  const peakHours = findPeakSittingHours(daily)

  const payload: Record<string, unknown> = {
    date,
    health: {
      totalSitMinutes: roundMinutes(daily.totalSitMs),
      totalStandMinutes: roundMinutes(daily.totalStandMs || 0),
      longestSitMinutes: roundMinutes(daily.longestSitMs),
      breakCount: daily.breakCount,
      effectiveStandCount: report.healthMetrics.effectiveStandCount,
      decompressionMinutes: report.healthMetrics.decompressionMinutes,
      dailyBreakGoal: settings.dailyBreakGoal,
      goalMet: daily.breakCount >= settings.dailyBreakGoal
    },
    execution: {
      reminderTriggered: daily.reminderTriggeredCount || 0,
      onTimeCount: report.execution.onTimeCount,
      delayedCount: report.execution.delayedCount,
      ignoredCount: report.execution.ignoredCount,
      onTimeRate: report.execution.onTimeRate,
      snoozeCount: daily.snoozeCount || 0,
      procrastinationRate: report.procrastination.todayRate
    },
    workRhythm: {
      activeWorkMinutes: roundMinutes(report.workMetrics.activeWorkMs),
      awayMinutes: roundMinutes(report.workMetrics.awayMs),
      breakMinutes: roundMinutes(report.workMetrics.breakMs),
      focusPeak: report.workMetrics.focusPeakMessage || null,
      peakSittingHours: peakHours,
      peakSittingInsight: report.insight?.message || null,
      sittingTimeline: daily.sessions
        .filter((s) => (s.type ?? 'sitting') === 'sitting' && s.endAt)
        .map((s) => ({
          start: formatTimeMs(s.startAt),
          end: formatTimeMs(s.endAt!),
          minutes: roundMinutes(s.endAt! - s.startAt),
          endReason: s.endReason || 'unknown'
        })),
      delayEvents: (daily.snoozes || []).map((s) => ({
        at: formatTimeMs(s.at),
        delayedMinutes: s.minutes
      }))
    },
    trends: {
      goalAchievementRate7: report.goalAchievementRate7,
      goalAchievementRate30: report.goalAchievementRate30,
      weekBreakTotal: report.weekBreakTotal,
      weekSnoozeDelta: report.procrastination.weekRateDelta,
      personalPercentile: report.personalPercentile,
      personalMessage: report.personalPercentileMessage || null
    },
    appDistribution: {
      totalTrackedMinutes: roundMinutes(appUsage.totalTrackedMs),
      categories: appUsage.categoryTotals.map((item) => ({
        category: CATEGORY_LABELS[item.category] || item.category,
        minutes: roundMinutes(item.durationMs)
      })),
      hourlyPattern: appUsage.hourlyBuckets
        .filter((bucket) => bucket.workMs + bucket.entertainmentMs + bucket.neutralMs > 0)
        .map((bucket) => ({
          hour: bucket.label,
          workMinutes: roundMinutes(bucket.workMs),
          entertainmentMinutes: roundMinutes(bucket.entertainmentMs),
          neutralMinutes: roundMinutes(bucket.neutralMs)
        }))
    },
    ruleInsights: report.insights.slice(0, 6).map((item) => item.message),
    settings: {
      sitIntervalMinutes: settings.sitIntervalMinutes
    }
  }

  if (includeAppNames) {
    payload.topApps = appUsage.appTotals.slice(0, 8).map((app) => ({
      name: app.label,
      category: CATEGORY_LABELS[app.category] || app.category,
      minutes: roundMinutes(app.durationMs)
    }))
  }

  return payload
}
