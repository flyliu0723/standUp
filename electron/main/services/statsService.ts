import Store from 'electron-store'
import { settingsService } from './settingsService'
import { DailyStats, SessionEndReason, SessionType, WorkSession, SAVED_MS_PER_BREAK } from '../types/session'

interface StatsStoreSchema {
  dailyStats: Record<string, DailyStats>
}

function todayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function createEmptyDaily(date: string): DailyStats {
  return {
    date,
    totalSitMs: 0,
    totalStandMs: 0,
    breakCount: 0,
    longestSitMs: 0,
    snoozeCount: 0,
    snoozes: [],
    sessions: []
  }
}

function normalizeSession(session: WorkSession): WorkSession {
  return {
    ...session,
    type: session.type ?? 'sitting'
  }
}

const store = new Store<StatsStoreSchema>({
  name: 'standup-stats',
  defaults: {
    dailyStats: {}
  }
})

export class StatsService {
  ensureToday(): DailyStats {
    const key = todayKey()
    const all = store.get('dailyStats')
    if (!all[key]) {
      all[key] = createEmptyDaily(key)
      store.set('dailyStats', all)
    }
    return all[key]
  }

  getStatsByDate(date: string): DailyStats {
    const all = store.get('dailyStats')
    const daily = all[date] ? all[date] : createEmptyDaily(date)
    return {
      ...daily,
      totalStandMs: daily.totalStandMs || 0,
      snoozes: [...(daily.snoozes || [])],
      sessions: daily.sessions.map(normalizeSession)
    }
  }

  getTodayStats(): DailyStats {
    return this.getStatsByDate(todayKey())
  }

  getHistoryDates(): string[] {
    return Object.keys(store.get('dailyStats')).sort((a, b) => b.localeCompare(a))
  }

  markWorkStart(): void {
    const key = todayKey()
    const all = store.get('dailyStats')
    const daily = all[key] || createEmptyDaily(key)
    if (!daily.workStartAt) {
      daily.workStartAt = Date.now()
    }
    all[key] = daily
    store.set('dailyStats', all)
  }

  startSession(sessionId: string, type: SessionType, startAt = Date.now()): WorkSession {
    const key = todayKey()
    const all = store.get('dailyStats')
    const daily = all[key] || createEmptyDaily(key)
    const session: WorkSession = { id: sessionId, type, startAt }
    daily.sessions.push(session)
    all[key] = daily
    store.set('dailyStats', all)
    return session
  }

  endSession(
    sessionId: string,
    endReason: SessionEndReason,
    endAt = Date.now()
  ): WorkSession | null {
    const key = todayKey()
    const all = store.get('dailyStats')
    const daily = all[key] || createEmptyDaily(key)
    const session = daily.sessions.find((s) => s.id === sessionId && !s.endAt)
    if (!session) {
      return null
    }

    const type = session.type ?? 'sitting'
    const duration = Math.max(0, endAt - session.startAt)
    session.endAt = endAt
    session.endReason = endReason
    session.type = type

    if (type === 'standing') {
      daily.totalStandMs = (daily.totalStandMs || 0) + duration
    } else {
      daily.totalSitMs += duration
      if (duration > daily.longestSitMs) {
        daily.longestSitMs = duration
      }
      if (endReason === 'reminder' || endReason === 'manual' || endReason === 'auto_idle') {
        daily.breakCount += 1
      }
    }

    all[key] = daily
    store.set('dailyStats', all)
    return session
  }

  recordSnooze(minutes: number): void {
    const key = todayKey()
    const all = store.get('dailyStats')
    const daily = all[key] || createEmptyDaily(key)
    if (!daily.snoozes) {
      daily.snoozes = []
    }
    daily.snoozes.push({ at: Date.now(), minutes })
    daily.snoozeCount = (daily.snoozeCount || 0) + 1
    all[key] = daily
    store.set('dailyStats', all)
  }

  checkDateRollover(): void {
    this.ensureToday()
  }

  calcSavedSitMs(breakCount: number): number {
    return breakCount * SAVED_MS_PER_BREAK
  }

  getRangeStats(endDateStr: string | undefined, days: number): import('../types/session').RangeDayStat[] {
    const end = endDateStr ? new Date(endDateStr) : new Date()
    const all = store.get('dailyStats')
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const goal = settingsService.getSettings().dailyBreakGoal
    const result: import('../types/session').RangeDayStat[] = []

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end)
      d.setDate(d.getDate() - i)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const key = `${y}-${m}-${day}`
      const daily = all[key] || createEmptyDaily(key)
      result.push({
        date: key,
        label: `${m}/${day} 周${weekDays[d.getDay()]}`,
        breakCount: daily.breakCount,
        totalSitMs: daily.totalSitMs,
        goalMet: daily.breakCount >= goal
      })
    }
    return result
  }

  getWeeklyStats(endDateStr?: string): import('../types/session').RangeDayStat[] {
    return this.getRangeStats(endDateStr, 7)
  }

  getMonthlyStats(endDateStr?: string): import('../types/session').RangeDayStat[] {
    return this.getRangeStats(endDateStr, 30)
  }

  calcGoalAchievementRate(stats: import('../types/session').RangeDayStat[]): number {
    if (stats.length === 0) return 0
    const met = stats.filter((d) => d.goalMet).length
    return Math.round((met / stats.length) * 100)
  }

  calcLocalPercentile(todayBreakCount: number, monthly: import('../types/session').RangeDayStat[]): {
    percentile: number
    message: string
  } {
    const counts = monthly.map((d) => d.breakCount)
    if (counts.length === 0) {
      return { percentile: 0, message: '继续积累数据，解锁个人成就对比' }
    }
    const below = counts.filter((c) => c < todayBreakCount).length
    const percentile = Math.round((below / counts.length) * 100)
    return {
      percentile,
      message: `今日起立表现超越了你自己过去 ${percentile}% 的日子`
    }
  }

  analyzePeakSitting(date: string): import('../types/session').SittingInsight | null {
    const daily = this.getStatsByDate(date)
    if (daily.sessions.length === 0) {
      return null
    }

    const hourBuckets = new Array(24).fill(0) as number[]
    for (const s of daily.sessions) {
      if ((s.type ?? 'sitting') !== 'sitting') {
        continue
      }
      const start = new Date(s.startAt)
      const end = s.endAt ? new Date(s.endAt) : new Date()
      let cursor = new Date(start)
      while (cursor < end) {
        const h = cursor.getHours()
        const nextHour = new Date(cursor)
        nextHour.setHours(h + 1, 0, 0, 0)
        const sliceEnd = nextHour < end ? nextHour : end
        hourBuckets[h] += sliceEnd.getTime() - cursor.getTime()
        cursor = sliceEnd
      }
    }

    let peakHour = 0
    let peakMs = 0
    hourBuckets.forEach((ms, h) => {
      if (ms > peakMs) {
        peakMs = ms
        peakHour = h
      }
    })

    if (peakMs < 30 * 60_000) {
      return null
    }

    let peakEnd = peakHour
    for (let h = peakHour + 1; h < 24; h++) {
      if (hourBuckets[h] >= 20 * 60_000) {
        peakEnd = h
      } else {
        break
      }
    }

    const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`
    const peakStart = fmt(peakHour)
    const peakEndStr = peakEnd === peakHour ? fmt(peakHour + 1) : fmt(peakEnd + 1)

    return {
      peakStart,
      peakEnd: peakEndStr,
      message: `你经常在 ${peakStart} - ${peakEndStr} 连续久坐，建议在此期间开启强提醒。`
    }
  }

  getReportSummary(date: string): import('../types/session').ReportSummary {
    const weekly = this.getWeeklyStats(date)
    const monthly = this.getMonthlyStats(date)
    const insight = this.analyzePeakSitting(date)
    const weekBreakTotal = weekly.reduce((s, d) => s + d.breakCount, 0)
    const weekSitMs = weekly.reduce((s, d) => s + d.totalSitMs, 0)
    const monthBreakTotal = monthly.reduce((s, d) => s + d.breakCount, 0)
    const savedSitMs = this.calcSavedSitMs(monthBreakTotal)
    const todayStats = this.getStatsByDate(date)
    const { percentile, message } = this.calcLocalPercentile(todayStats.breakCount, monthly)

    return {
      weekly,
      monthly,
      insight,
      weekBreakTotal,
      weekSitMs,
      monthBreakTotal,
      savedSitMs,
      goalAchievementRate7: this.calcGoalAchievementRate(weekly),
      goalAchievementRate30: this.calcGoalAchievementRate(monthly),
      personalPercentile: percentile,
      personalPercentileMessage: message
    }
  }
}

export const statsService = new StatsService()
