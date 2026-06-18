import { onMounted, onUnmounted, ref } from 'vue'
import type { SessionStatus } from '@/types/session'

export function useSessionStatus(pollMs = 1000) {
  const status = ref<SessionStatus>({
    state: 'offDuty',
    currentSitMs: 0,
    currentStandMs: 0,
    timerRemainingMs: 0,
    timerMode: 'none',
    sitIntervalMinutes: 40,
    standIntervalMinutes: 5,
    isPaused: false
  })

  let unsubscribe: (() => void) | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function refresh(): Promise<void> {
    status.value = await window.standUp.getSessionStatus()
  }

  onMounted(() => {
    refresh()
    unsubscribe = window.standUp.onStateChange((s) => {
      status.value = s
    })
    pollTimer = setInterval(() => {
      if (
        status.value.isPaused ||
        status.value.state === 'sitting' ||
        status.value.state === 'standing' ||
        status.value.state === 'away'
      ) {
        refresh()
      }
    }, pollMs)
  })

  onUnmounted(() => {
    unsubscribe?.()
    if (pollTimer) clearInterval(pollTimer)
  })

  return { status, refresh }
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
