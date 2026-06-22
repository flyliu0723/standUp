import type { PauseRecord, StandReasonId, WorkSession } from '@/types/session'
import { getStandReasonGradient, STAND_REASON_LABELS } from '@/utils/standReasons'
import { formatTime, formatMs } from '@/utils/format'

export type BreakReasonKey = StandReasonId | 'unknown'

export const BREAK_REASON_ORDER: BreakReasonKey[] = [
  'water',
  'bathroom',
  'other',
  'lunch',
  'meeting',
  'unknown'
]

export interface TimelineBlock {
  type: 'sit' | 'break' | 'away'
  standReason?: BreakReasonKey
  startPct: number
  widthPct: number
  title: string
  tag?: string
}

export interface HourlySummary {
  hour: number
  label: string
  sitMs: number
  breakMs: number
  awayMs: number
  breakByReason: Partial<Record<BreakReasonKey, number>>
  dominant: 'sit' | 'break' | 'away' | 'none'
  intensity: number
}

export interface BehaviorTag {
  label: string
  time: string
  duration: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const MIN_GAP_MS = 60_000

function getDayStart(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

function pushBlock(
  result: TimelineBlock[],
  type: TimelineBlock['type'],
  start: number,
  end: number,
  title: string,
  dayStart: number,
  tag?: string,
  standReason?: BreakReasonKey
): void {
  const dayEnd = dayStart + DAY_MS
  const clampedStart = Math.max(start, dayStart)
  const clampedEnd = Math.min(end, dayEnd)
  if (clampedEnd <= clampedStart) return

  result.push({
    type,
    standReason: type === 'break' ? standReason ?? 'unknown' : undefined,
    startPct: ((clampedStart - dayStart) / DAY_MS) * 100,
    widthPct: ((clampedEnd - clampedStart) / DAY_MS) * 100,
    title,
    tag
  })
}

export function inferBehaviorTag(
  durationMs: number,
  startAt: number,
  isAway: boolean
): string {
  const minutes = Math.round(durationMs / 60_000)
  const hour = new Date(startAt).getHours()

  if (isAway) {
    if (minutes >= 30 && (hour < 12 || hour >= 13)) return '开会/外勤'
    if (minutes >= 15) return '离座较久'
    if (minutes >= 5 && minutes <= 12) return '接水/放风'
    return '短暂离座'
  }

  if (minutes >= 15) return '深度休息'
  if (minutes >= 5) return '站立放松'
  return '短暂活动'
}

export function getSessionBehaviorTag(session: WorkSession): string {
  if (session.standReason) {
    return STAND_REASON_LABELS[session.standReason]
  }
  if ((session.type ?? 'sitting') === 'standing') {
    return inferBehaviorTag(
      session.endAt ? session.endAt - session.startAt : 0,
      session.startAt,
      false
    )
  }
  return '专注久坐'
}

export function buildTimelineBlocks(
  sessions: WorkSession[],
  date: string,
  pauseRecords: PauseRecord[] = []
): TimelineBlock[] {
  if (!sessions.length) return []

  const dayStart = getDayStart(date)
  const sorted = [...sessions].sort((a, b) => a.startAt - b.startAt)
  const result: TimelineBlock[] = []

  sorted.forEach((s, index) => {
    const start = Math.max(s.startAt, dayStart)
    const end = s.endAt ? Math.min(s.endAt, dayStart + DAY_MS) : Date.now()
    if (end <= start) return

    if (index > 0) {
      const prev = sorted[index - 1]
      if (prev.endAt) {
        const gapStart = prev.endAt
        const gapEnd = s.startAt
        if (gapEnd - gapStart >= MIN_GAP_MS) {
          const isAway = prev.endReason === 'idle'
          const tag = inferBehaviorTag(gapEnd - gapStart, gapStart, isAway)
          pushBlock(
            result,
            isAway ? 'away' : 'break',
            gapStart,
            gapEnd,
            isAway
              ? `离开 ${formatTime(gapStart)} - ${formatTime(gapEnd)} (${formatMs(gapEnd - gapStart)}) · ${tag}`
              : `休息 ${formatTime(gapStart)} - ${formatTime(gapEnd)} (${formatMs(gapEnd - gapStart)}) · ${tag}`,
            dayStart,
            tag
          )
        }
      }
    }

    const sessionType = s.type ?? 'sitting'
    const blockType = sessionType === 'standing' ? 'break' : 'sit'
    const behaviorTag = getSessionBehaviorTag(s)
    const label =
      sessionType === 'standing'
        ? s.standReason
          ? STAND_REASON_LABELS[s.standReason]
          : '站立'
        : '久坐'

    pushBlock(
      result,
      blockType,
      start,
      end,
      `${label} ${formatTime(s.startAt)} - ${s.endAt ? formatTime(s.endAt) : '进行中'} (${s.endAt ? formatMs(s.endAt - s.startAt) : ''})`,
      dayStart,
      behaviorTag,
      sessionType === 'standing' ? s.standReason ?? 'unknown' : undefined
    )
  })

  const sortedPauses = [...pauseRecords].sort((a, b) => a.startAt - b.startAt)
  for (const pause of sortedPauses) {
    const start = Math.max(pause.startAt, dayStart)
    const end = pause.endAt ? Math.min(pause.endAt, dayStart + DAY_MS) : Date.now()
    if (end <= start) continue
    const tag = STAND_REASON_LABELS[pause.reason]
    pushBlock(
      result,
      'break',
      start,
      end,
      `${tag} ${formatTime(start)} - ${pause.endAt ? formatTime(end) : '进行中'} (${formatMs(end - start)})`,
      dayStart,
      tag,
      pause.reason
    )
  }

  return result.sort((a, b) => a.startPct - b.startPct)
}

function addToHourBucket(
  buckets: HourlySummary[],
  start: number,
  end: number,
  kind: 'sit' | 'break' | 'away',
  standReason?: BreakReasonKey
): void {
  const hourStart = new Date(start)
  hourStart.setMinutes(0, 0, 0)
  let cursor = Math.max(start, hourStart.getTime())
  const endTs = end

  while (cursor < endTs) {
    const hour = new Date(cursor).getHours()
    const nextHour = new Date(cursor)
    nextHour.setHours(hour + 1, 0, 0, 0)
    const sliceEnd = Math.min(endTs, nextHour.getTime())
    const ms = sliceEnd - cursor

    if (!buckets[hour]) {
      buckets[hour] = {
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        sitMs: 0,
        breakMs: 0,
        awayMs: 0,
        breakByReason: {},
        dominant: 'none',
        intensity: 0
      }
    }

    if (kind === 'sit') {
      buckets[hour].sitMs += ms
    } else if (kind === 'break') {
      buckets[hour].breakMs += ms
      const key = standReason ?? 'unknown'
      buckets[hour].breakByReason[key] = (buckets[hour].breakByReason[key] ?? 0) + ms
    } else {
      buckets[hour].awayMs += ms
    }

    cursor = sliceEnd
  }
}

export function buildHourlySummary(sessions: WorkSession[], date: string, pauseRecords: PauseRecord[] = []): HourlySummary[] {
  const blocks = buildTimelineBlocks(sessions, date, pauseRecords)
  const buckets: HourlySummary[] = []

  const dayStart = getDayStart(date)
  for (const block of blocks) {
    const start = dayStart + (block.startPct / 100) * DAY_MS
    const end = start + (block.widthPct / 100) * DAY_MS
    addToHourBucket(
      buckets,
      start,
      end,
      block.type === 'sit' ? 'sit' : block.type === 'break' ? 'break' : 'away',
      block.standReason
    )
  }

  return buckets
    .filter(Boolean)
    .map((b) => {
      const total = b.sitMs + b.breakMs + b.awayMs
      let dominant: HourlySummary['dominant'] = 'none'
      if (total > 0) {
        if (b.sitMs >= b.breakMs && b.sitMs >= b.awayMs) dominant = 'sit'
        else if (b.breakMs >= b.awayMs) dominant = 'break'
        else dominant = 'away'
      }
      return {
        ...b,
        dominant,
        intensity: Math.min(100, Math.round((total / (60 * 60_000)) * 100))
      }
    })
    .sort((a, b) => a.hour - b.hour)
}

export function extractBehaviorTags(
  sessions: WorkSession[],
  date: string,
  pauseRecords: PauseRecord[] = []
): BehaviorTag[] {
  const blocks = buildTimelineBlocks(sessions, date, pauseRecords)
  const dayStart = getDayStart(date)

  return blocks
    .filter((b) => b.tag && b.type !== 'sit')
    .map((b) => {
      const start = dayStart + (b.startPct / 100) * DAY_MS
      const end = start + (b.widthPct / 100) * DAY_MS
      return {
        label: b.tag!,
        time: formatTime(start),
        duration: formatMs(end - start)
      }
    })
    .slice(-8)
    .reverse()
}

export function timelineBlockStyle(block: TimelineBlock, minWidthPct = 0.3): Record<string, string> {
  const style: Record<string, string> = {
    left: `${block.startPct}%`,
    width: `${Math.max(block.widthPct, minWidthPct)}%`
  }
  if (block.type === 'break') {
    const reason = block.standReason === 'unknown' ? undefined : block.standReason
    style.background = getStandReasonGradient(reason)
  }
  return style
}

export function calcAwayMsFromSessions(sessions: WorkSession[], date: string): number {
  const blocks = buildTimelineBlocks(sessions, date)
  const dayStart = getDayStart(date)
  return blocks
    .filter((b) => b.type === 'away')
    .reduce((sum, b) => sum + (b.widthPct / 100) * DAY_MS, 0)
}
