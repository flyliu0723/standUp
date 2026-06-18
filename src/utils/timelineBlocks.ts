import type { WorkSession } from '@/types/session'
import { formatTime, formatMs } from '@/utils/format'

export interface TimelineBlock {
  type: 'sit' | 'break' | 'away'
  startPct: number
  widthPct: number
  title: string
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
  dayStart: number
): void {
  const dayEnd = dayStart + DAY_MS
  const clampedStart = Math.max(start, dayStart)
  const clampedEnd = Math.min(end, dayEnd)
  if (clampedEnd <= clampedStart) return

  result.push({
    type,
    startPct: ((clampedStart - dayStart) / DAY_MS) * 100,
    widthPct: ((clampedEnd - clampedStart) / DAY_MS) * 100,
    title
  })
}

export function buildTimelineBlocks(sessions: WorkSession[], date: string): TimelineBlock[] {
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
          pushBlock(
            result,
            isAway ? 'away' : 'break',
            gapStart,
            gapEnd,
            isAway
              ? `离开 ${formatTime(gapStart)} - ${formatTime(gapEnd)} (${formatMs(gapEnd - gapStart)})`
              : `休息 ${formatTime(gapStart)} - ${formatTime(gapEnd)} (${formatMs(gapEnd - gapStart)})`,
            dayStart
          )
        }
      }
    }

    const sessionType = s.type ?? 'sitting'
    const blockType = sessionType === 'standing' ? 'break' : 'sit'
    const label = sessionType === 'standing' ? '站立' : '久坐'

    pushBlock(
      result,
      blockType,
      start,
      end,
      `${label} ${formatTime(s.startAt)} - ${s.endAt ? formatTime(s.endAt) : '进行中'} (${s.endAt ? formatMs(s.endAt - s.startAt) : ''})`,
      dayStart
    )
  })

  return result
}

export function timelineBlockStyle(block: TimelineBlock, minWidthPct = 0.3): Record<string, string> {
  return {
    left: `${block.startPct}%`,
    width: `${Math.max(block.widthPct, minWidthPct)}%`
  }
}
