import type { AppCategory, AppUsageDailySummary } from '@/types/session'

export const APP_CATEGORY_COLORS: Record<AppCategory, string> = {
  work: '#6366f1',
  entertainment: '#f59e0b',
  social: '#ec4899',
  neutral: '#94a3b8'
}

export const APP_CATEGORY_LABELS: Record<AppCategory, string> = {
  work: '工作',
  entertainment: '娱乐',
  social: '社交',
  neutral: '其他'
}

export const APP_CATEGORY_OPTIONS = (Object.keys(APP_CATEGORY_LABELS) as AppCategory[]).map(
  (value) => ({
    value,
    label: APP_CATEGORY_LABELS[value]
  })
)

export const APP_CATEGORY_BG: Record<AppCategory, string> = {
  work: 'rgba(99, 102, 241, 0.85)',
  entertainment: 'rgba(245, 158, 11, 0.85)',
  social: 'rgba(236, 72, 153, 0.85)',
  neutral: 'rgba(148, 163, 184, 0.85)'
}

export function createEmptyAppUsageSummary(date = ''): AppUsageDailySummary {
  return {
    date,
    segments: [],
    appTotals: [],
    categoryTotals: [],
    hourlyBuckets: [],
    browserSiteTotals: [],
    totalTrackedMs: 0
  }
}

export function formatUsageDuration(ms: number): string {
  if (ms <= 0) return '0 分'
  const totalMinutes = Math.round(ms / 60_000)
  if (totalMinutes < 60) return `${totalMinutes} 分`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`
}

export function formatUsagePercent(partMs: number, totalMs: number): string {
  if (totalMs <= 0) return '0%'
  return `${Math.round((partMs / totalMs) * 100)}%`
}
