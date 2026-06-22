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

export function getStandReasonConfig(id: StandReasonId): StandReasonConfig {
  const found = STAND_REASON_OPTIONS.find((o) => o.id === id)
  if (!found) {
    return STAND_REASON_OPTIONS.find((o) => o.id === 'other')!
  }
  return found
}
