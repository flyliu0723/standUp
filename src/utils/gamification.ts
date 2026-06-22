import type { GamificationState } from '@/types/session'

const LEVEL_TITLES: { min: number; title: string }[] = [
  { min: 20, title: '久坐克星' },
  { min: 10, title: '颈椎守护者' },
  { min: 5, title: '血液循环大师' },
  { min: 3, title: '久坐斗士' },
  { min: 1, title: '起身萌新' }
]

const POINTS_PER_LEVEL = 10

export function getLevelTitle(level: number): string {
  const found = LEVEL_TITLES.find((t) => level >= t.min)
  return found?.title ?? '起身萌新'
}

export function getLevelProgress(state: GamificationState): {
  percent: number
  pointsInLevel: number
  pointsToNext: number
} {
  const pointsInLevel = state.growthPoints - (state.level - 1) * POINTS_PER_LEVEL
  const percent = Math.min(100, Math.round((pointsInLevel / POINTS_PER_LEVEL) * 100))
  const pointsToNext = POINTS_PER_LEVEL - pointsInLevel
  return { percent, pointsInLevel, pointsToNext }
}
