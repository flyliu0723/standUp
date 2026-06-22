import {
  classifyProcess,
  getBuiltinAppCatalog,
  getDefaultCategory,
  getAppLabel,
  type AppCategory,
  type AppCategoryConfigItem
} from '../constants/appCategories'
import { enrichBrowserSegmentMeta, isBrowserProcess } from '../utils/browserTitleParser'
import { settingsService } from './settingsService'
import Store from 'electron-store'
import type { AppUsageSegment } from '../types/session'

const usageStore = new Store<{ segmentsByDate: Record<string, AppUsageSegment[]> }>({
  name: 'standup-app-usage',
  defaults: { segmentsByDate: {} }
})

function getObservedProcessNames(): string[] {
  const names = new Set<string>()
  const all = usageStore.get('segmentsByDate')
  for (const segments of Object.values(all)) {
    for (const segment of segments) {
      names.add(segment.processName.toLowerCase())
    }
  }
  return [...names]
}

export function getCategoryOverrides(): Record<string, AppCategory> {
  return settingsService.getSettings().appCategoryOverrides ?? {}
}

export function classifyApp(
  processName: string | null,
  windowTitle?: string | null
): AppCategory {
  return classifyProcess(processName, windowTitle, getCategoryOverrides())
}

export function resolveUsageSegmentCategory(segment: AppUsageSegment): AppCategory {
  if (isBrowserProcess(segment.processName)) {
    const browserMeta = enrichBrowserSegmentMeta(segment.processName, segment.windowTitle)
    if (browserMeta) {
      return browserMeta.category
    }
    return segment.category
  }
  return classifyApp(segment.processName, segment.windowTitle)
}

export function normalizeUsageSegment(segment: AppUsageSegment): AppUsageSegment {
  const category = resolveUsageSegmentCategory(segment)
  if (category === segment.category) {
    return segment
  }
  return { ...segment, category }
}

export function reclassifyStoredUsageSegments(): void {
  const all = usageStore.get('segmentsByDate')
  let changed = false
  for (const date of Object.keys(all)) {
    const next = all[date].map((segment) => {
      const normalized = normalizeUsageSegment(segment)
      if (normalized.category !== segment.category) {
        changed = true
      }
      return normalized
    })
    all[date] = next
  }
  if (changed) {
    usageStore.set('segmentsByDate', all)
  }
}

export function listAppCategoryConfigs(): AppCategoryConfigItem[] {
  const overrides = getCategoryOverrides()
  const map = new Map<string, AppCategoryConfigItem>()

  for (const entry of getBuiltinAppCatalog()) {
    const lower = entry.processName.toLowerCase()
    const isBrowser = isBrowserProcess(lower)
    const defaultCategory = entry.defaultCategory
    const effectiveCategory = isBrowser
      ? defaultCategory
      : overrides[lower] ?? defaultCategory
    map.set(lower, {
      ...entry,
      processName: lower,
      effectiveCategory,
      isOverridden: !isBrowser && overrides[lower] !== undefined,
      source: 'builtin',
      isBrowser,
      categoryEditable: !isBrowser
    })
  }

  for (const processName of getObservedProcessNames()) {
    const lower = processName.toLowerCase()
    if (map.has(lower)) {
      continue
    }
    const isBrowser = isBrowserProcess(lower)
    const defaultCategory = getDefaultCategory(lower)
    map.set(lower, {
      processName: lower,
      label: getAppLabel(lower) ?? lower.replace(/\.exe$/i, ''),
      defaultCategory,
      effectiveCategory: isBrowser ? defaultCategory : overrides[lower] ?? defaultCategory,
      isOverridden: !isBrowser && overrides[lower] !== undefined,
      source: 'observed',
      isBrowser,
      categoryEditable: !isBrowser
    })
  }

  return [...map.values()].sort((a, b) => {
    if (a.source !== b.source) {
      return a.source === 'builtin' ? -1 : 1
    }
    return a.label.localeCompare(b.label, 'zh-CN')
  })
}

export type { AppCategoryConfigItem }
