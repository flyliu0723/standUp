import { randomUUID } from 'crypto'
import Store from 'electron-store'
import { getAppLabel } from '../constants/appCategories'
import { classifyApp, normalizeUsageSegment } from './appCategoryService'
import { buildAppUsageDailySummary } from '../utils/appUsageAggregation'
import {
  enrichBrowserSegmentMeta,
  getBrowserSiteIdentity,
  isBrowserProcess
} from '../utils/browserTitleParser'
import type { AppUsageDailySummary, AppUsageSegment } from '../types/session'

interface AppUsageStoreSchema {
  segmentsByDate: Record<string, AppUsageSegment[]>
}

const store = new Store<AppUsageStoreSchema>({
  name: 'standup-app-usage',
  defaults: {
    segmentsByDate: {}
  }
})

function todayKey(at = Date.now()): string {
  const now = new Date(at)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function buildSegmentMeta(processName: string, windowTitle: string | null | undefined) {
  const browserMeta = enrichBrowserSegmentMeta(processName, windowTitle)
  if (browserMeta) {
    return {
      label: getAppLabel(processName) ?? processName,
      category: browserMeta.category,
      windowTitle: windowTitle ?? undefined,
      siteKey: browserMeta.siteKey,
      siteLabel: browserMeta.siteLabel
    }
  }
  return {
    label: getAppLabel(processName) ?? processName,
    category: classifyApp(processName, windowTitle),
    windowTitle: windowTitle ?? undefined,
    siteKey: undefined,
    siteLabel: undefined
  }
}

export class AppUsageService {
  private currentProcessName: string | null = null
  private currentWindowTitle: string | null = null
  private currentSiteIdentity: string | null = null
  private currentSegmentId: string | null = null
  private currentStartAt = 0

  onForegroundChanged(
    nextProcessName: string | null,
    nextWindowTitle: string | null,
    at = Date.now()
  ): void {
    if (this.currentProcessName && this.currentStartAt > 0) {
      this.closeCurrentSegment(at, this.currentWindowTitle)
    }

    this.currentProcessName = nextProcessName
    this.currentWindowTitle = nextWindowTitle
    this.currentSiteIdentity = getBrowserSiteIdentity(nextProcessName, nextWindowTitle)

    if (nextProcessName) {
      this.openSegment(nextProcessName, nextWindowTitle, at)
    } else {
      this.currentSegmentId = null
      this.currentStartAt = 0
    }
  }

  flushCurrentSegment(at = Date.now()): void {
    if (!this.currentProcessName || this.currentStartAt <= 0) {
      return
    }
    this.closeCurrentSegment(at, this.currentWindowTitle)
    this.currentProcessName = null
    this.currentWindowTitle = null
    this.currentSiteIdentity = null
    this.currentSegmentId = null
    this.currentStartAt = 0
  }

  syncForeground(processName: string | null, windowTitle: string | null, at = Date.now()): void {
    if (processName === this.currentProcessName) {
      const nextSiteIdentity = getBrowserSiteIdentity(processName, windowTitle)
      if (
        isBrowserProcess(processName) &&
        nextSiteIdentity &&
        nextSiteIdentity !== this.currentSiteIdentity
      ) {
        this.closeCurrentSegment(at, this.currentWindowTitle)
        this.currentWindowTitle = windowTitle
        this.currentSiteIdentity = nextSiteIdentity
        this.openSegment(processName, windowTitle, at)
        return
      }
      this.currentWindowTitle = windowTitle
      this.currentSiteIdentity = nextSiteIdentity
      return
    }
    this.onForegroundChanged(processName, windowTitle, at)
  }

  getKnownProcessNames(): string[] {
    const names = new Set<string>()
    const all = store.get('segmentsByDate')
    for (const segments of Object.values(all)) {
      for (const segment of segments) {
        names.add(segment.processName.toLowerCase())
      }
    }
    if (this.currentProcessName) {
      names.add(this.currentProcessName.toLowerCase())
    }
    return [...names]
  }

  getDailySummary(date: string): AppUsageDailySummary {
    const all = store.get('segmentsByDate')
    const segments = [...(all[date] || [])].map(normalizeUsageSegment)
    const openSegment = this.getOpenSegmentForDate(date)
    if (openSegment) {
      segments.push(normalizeUsageSegment(openSegment))
    }
    return buildAppUsageDailySummary(date, segments)
  }

  private getOpenSegmentForDate(date: string): AppUsageSegment | null {
    if (!this.currentProcessName || !this.currentSegmentId || this.currentStartAt <= 0) {
      return null
    }
    if (todayKey(this.currentStartAt) !== date && todayKey() !== date) {
      return null
    }
    const meta = buildSegmentMeta(this.currentProcessName, this.currentWindowTitle)
    return {
      id: this.currentSegmentId,
      processName: this.currentProcessName,
      label: meta.label,
      category: meta.category,
      windowTitle: meta.windowTitle,
      siteKey: meta.siteKey,
      siteLabel: meta.siteLabel,
      startAt: this.currentStartAt
    }
  }

  private openSegment(processName: string, windowTitle: string | null, startAt: number): void {
    this.currentSegmentId = randomUUID()
    this.currentStartAt = startAt
    this.currentWindowTitle = windowTitle
    this.currentSiteIdentity = getBrowserSiteIdentity(processName, windowTitle)
  }

  private closeCurrentSegment(endAt: number, windowTitle: string | null): void {
    if (!this.currentProcessName || !this.currentSegmentId || this.currentStartAt <= 0) {
      return
    }
    if (endAt <= this.currentStartAt) {
      return
    }

    const meta = buildSegmentMeta(this.currentProcessName, windowTitle ?? this.currentWindowTitle)
    const base = {
      processName: this.currentProcessName,
      label: meta.label,
      category: meta.category,
      windowTitle: meta.windowTitle,
      siteKey: meta.siteKey,
      siteLabel: meta.siteLabel
    }

    let cursor = this.currentStartAt
    while (cursor < endAt) {
      const dayStart = new Date(cursor)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = dayStart.getTime() + 24 * 60 * 60 * 1000
      const sliceEnd = Math.min(endAt, dayEnd)
      if (sliceEnd > cursor) {
        this.appendSegment({
          id: `${this.currentSegmentId}-${cursor}`,
          ...base,
          startAt: cursor,
          endAt: sliceEnd
        })
      }
      cursor = sliceEnd
    }

    this.currentSegmentId = null
    this.currentStartAt = 0
  }

  private appendSegment(segment: AppUsageSegment): void {
    const date = todayKey(segment.startAt)
    const all = store.get('segmentsByDate')
    const list = all[date] || []
    list.push(segment)
    all[date] = list
    store.set('segmentsByDate', all)
  }
}

export const appUsageService = new AppUsageService()
