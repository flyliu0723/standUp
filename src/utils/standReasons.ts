export type StandReasonId = 'water' | 'bathroom' | 'other' | 'lunch' | 'meeting'

export type StandReasonMode = 'standing' | 'paused'

export interface StandReasonConfig {
  id: StandReasonId
  label: string
  emoji: string
  durationMinutes: number
  mode: StandReasonMode
  hint: string
}

export const STAND_REASON_OPTIONS: StandReasonConfig[] = [
  {
    id: 'water',
    label: '接水 / 放风',
    emoji: '🚰',
    durationMinutes: 5,
    mode: 'standing',
    hint: '短暂离开工位'
  },
  {
    id: 'bathroom',
    label: '上厕所',
    emoji: '🚻',
    durationMinutes: 15,
    mode: 'standing',
    hint: '预计 15 分钟'
  },
  {
    id: 'other',
    label: '其他短休',
    emoji: '🧘',
    durationMinutes: 5,
    mode: 'standing',
    hint: '默认站立时长'
  },
  {
    id: 'lunch',
    label: '午休',
    emoji: '🍱',
    durationMinutes: 90,
    mode: 'paused',
    hint: '暂停计时 1.5 小时'
  },
  {
    id: 'meeting',
    label: '开会 / 外勤',
    emoji: '📋',
    durationMinutes: 60,
    mode: 'paused',
    hint: '暂停计时 1 小时'
  }
]

export const STAND_REASON_LABELS: Record<StandReasonId, string> = Object.fromEntries(
  STAND_REASON_OPTIONS.map((o) => [o.id, o.label])
) as Record<StandReasonId, string>

export type StandReasonColorKey = StandReasonId | 'unknown'

export interface StandReasonColor {
  from: string
  to: string
  solid: string
  label: string
}

export const STAND_REASON_COLORS: Record<StandReasonColorKey, StandReasonColor> = {
  water: { from: '#67e8f9', to: '#06b6d4', solid: '#22d3ee', label: '接水 / 放风' },
  bathroom: { from: '#c4b5fd', to: '#8b5cf6', solid: '#a78bfa', label: '上厕所' },
  other: { from: '#86efac', to: '#22c55e', solid: '#4ade80', label: '其他短休' },
  lunch: { from: '#fdba74', to: '#f97316', solid: '#fb923c', label: '午休' },
  meeting: { from: '#93c5fd', to: '#3b82f6', solid: '#60a5fa', label: '开会 / 外勤' },
  unknown: { from: '#bbf7d0', to: '#4ade80', solid: '#86efac', label: '站立休息' }
}

export function getStandReasonGradient(reason?: StandReasonId): string {
  const colors = STAND_REASON_COLORS[reason ?? 'unknown']
  return `linear-gradient(180deg, ${colors.from}, ${colors.to})`
}

export function getStandReasonSolid(reason?: StandReasonId): string {
  return STAND_REASON_COLORS[reason ?? 'unknown'].solid
}

export function getStandReasonConfig(id: StandReasonId): StandReasonConfig {
  const found = STAND_REASON_OPTIONS.find((o) => o.id === id)
  if (!found) {
    return STAND_REASON_OPTIONS.find((o) => o.id === 'other')!
  }
  return found
}

export function formatReasonDuration(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    const h = minutes / 60
    return h === 1 ? '1 小时' : `${h} 小时`
  }
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
  }
  return `${minutes} 分钟`
}
