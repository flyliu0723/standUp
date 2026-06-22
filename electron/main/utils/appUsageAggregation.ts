import type {
  AppCategory,
  AppUsageAppTotal,
  AppUsageBrowserSiteTotal,
  AppUsageCategoryTotal,
  AppUsageDailySummary,
  AppUsageHourlyBucket,
  AppUsageSegment
} from '../types/session'
import { isBrowserProcess } from './browserTitleParser'

const CATEGORY_LABELS: Record<AppCategory, string> = {
  work: '工作',
  entertainment: '娱乐',
  social: '社交',
  neutral: '其他'
}

function getDayStart(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

function getDayEnd(date: string): number {
  return getDayStart(date) + 24 * 60 * 60 * 1000
}

function clampSegmentToDay(
  segment: AppUsageSegment,
  date: string,
  now: number
): { startAt: number; endAt: number } | null {
  const dayStart = getDayStart(date)
  const dayEnd = getDayEnd(date)
  const rawEnd = segment.endAt ?? now
  const startAt = Math.max(segment.startAt, dayStart)
  const endAt = Math.min(rawEnd, dayEnd, now)
  if (endAt <= startAt) {
    return null
  }
  return { startAt, endAt }
}

function addMsToHourBucket(
  buckets: AppUsageHourlyBucket[],
  startAt: number,
  endAt: number,
  category: AppCategory
): void {
  let cursor = startAt
  while (cursor < endAt) {
    const hour = new Date(cursor).getHours()
    const nextHour = new Date(cursor)
    nextHour.setHours(hour + 1, 0, 0, 0)
    const sliceEnd = Math.min(endAt, nextHour.getTime())
    const ms = sliceEnd - cursor

    if (!buckets[hour]) {
      buckets[hour] = {
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        workMs: 0,
        entertainmentMs: 0,
        socialMs: 0,
        neutralMs: 0
      }
    }

    if (category === 'work') {
      buckets[hour].workMs += ms
    } else if (category === 'entertainment') {
      buckets[hour].entertainmentMs += ms
    } else if (category === 'social') {
      buckets[hour].socialMs += ms
    } else {
      buckets[hour].neutralMs += ms
    }

    cursor = sliceEnd
  }
}

export function buildAppUsageDailySummary(
  date: string,
  segments: AppUsageSegment[],
  now = Date.now()
): AppUsageDailySummary {
  const appMap = new Map<string, AppUsageAppTotal>()
  const browserSiteMap = new Map<string, AppUsageBrowserSiteTotal>()
  const categoryMap = new Map<AppCategory, number>([
    ['work', 0],
    ['entertainment', 0],
    ['social', 0],
    ['neutral', 0]
  ])
  const hourlyBuckets: AppUsageHourlyBucket[] = []
  let totalTrackedMs = 0

  for (const segment of segments) {
    const clamped = clampSegmentToDay(segment, date, now)
    if (!clamped) {
      continue
    }
    const durationMs = clamped.endAt - clamped.startAt
    totalTrackedMs += durationMs
    categoryMap.set(segment.category, (categoryMap.get(segment.category) || 0) + durationMs)

    const existing = appMap.get(segment.processName)
    if (existing) {
      existing.durationMs += durationMs
    } else {
      appMap.set(segment.processName, {
        processName: segment.processName,
        label: segment.label,
        category: segment.category,
        durationMs,
        isBrowser: isBrowserProcess(segment.processName)
      })
    }

    if (segment.siteKey && segment.siteLabel && isBrowserProcess(segment.processName)) {
      const siteMapKey = `${segment.processName}::${segment.siteKey}`
      const siteExisting = browserSiteMap.get(siteMapKey)
      if (siteExisting) {
        siteExisting.durationMs += durationMs
      } else {
        browserSiteMap.set(siteMapKey, {
          processName: segment.processName,
          siteKey: segment.siteKey,
          siteLabel: segment.siteLabel,
          category: segment.category,
          durationMs
        })
      }
    }

    addMsToHourBucket(hourlyBuckets, clamped.startAt, clamped.endAt, segment.category)
  }

  const appTotals = [...appMap.values()].sort((a, b) => b.durationMs - a.durationMs)
  const browserSiteTotals = [...browserSiteMap.values()].sort((a, b) => b.durationMs - a.durationMs)
  const categoryTotals: AppUsageCategoryTotal[] = (
    ['work', 'entertainment', 'social', 'neutral'] as AppCategory[]
  )
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      durationMs: categoryMap.get(category) || 0
    }))
    .filter((item) => item.durationMs > 0)

  return {
    date,
    segments: segments.filter((segment) => clampSegmentToDay(segment, date, now) !== null),
    appTotals,
    categoryTotals,
    hourlyBuckets: hourlyBuckets.filter(Boolean).sort((a, b) => a.hour - b.hour),
    browserSiteTotals,
    totalTrackedMs
  }
}
