import Store from 'electron-store'

export interface GamificationState {
  growthPoints: number
  level: number
  streakDays: number
  lastBreakDate: string
  totalBreaks: number
}

interface GamificationStoreSchema {
  gamification: GamificationState
}

const DEFAULT_STATE: GamificationState = {
  growthPoints: 0,
  level: 1,
  streakDays: 0,
  lastBreakDate: '',
  totalBreaks: 0
}

const store = new Store<GamificationStoreSchema>({
  name: 'standup-gamification',
  defaults: {
    gamification: DEFAULT_STATE
  }
})

function todayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function calcLevel(points: number): number {
  return Math.max(1, Math.floor(points / 10) + 1)
}

export class GamificationService {
  getState(): GamificationState {
    return { ...store.get('gamification') }
  }

  recordBreak(goalMet: boolean): GamificationState {
    const state = this.getState()
    const today = todayKey()

    state.growthPoints += 1
    state.totalBreaks += 1
    state.level = calcLevel(state.growthPoints)

    if (goalMet) {
      if (state.lastBreakDate) {
        const last = new Date(state.lastBreakDate)
        const curr = new Date(today)
        const diffDays = Math.round((curr.getTime() - last.getTime()) / 86_400_000)
        if (diffDays === 1) {
          state.streakDays += 1
        } else if (diffDays > 1) {
          state.streakDays = 1
        }
      } else {
        state.streakDays = 1
      }
      state.lastBreakDate = today
    }

    store.set('gamification', state)
    return state
  }
}

export const gamificationService = new GamificationService()
