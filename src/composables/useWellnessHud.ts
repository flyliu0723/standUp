import { onMounted, onUnmounted, ref } from 'vue'
import type { WellnessHudStatus } from '@/types/session'

const DEFAULT_HUD: WellnessHudStatus = {
  mode: 'off_duty',
  bodyProgress: 0,
  bodyTier: 'neutral',
  mindLoad: 0,
  mindWaveform: [0, 0, 0, 0, 0, 0, 0, 0],
  actionText: '未上班',
  actionDetail: '点击开始追踪',
  countdownMs: 0,
  windowSwitches5m: 0,
  distinctApps5m: 0,
  clipboardOps5m: 0,
  foregroundLabel: null,
  statusLabel: '未上班',
  workState: 'offDuty'
}

export function useWellnessHud() {
  const hud = ref<WellnessHudStatus>({ ...DEFAULT_HUD })

  let unsubscribe: (() => void) | null = null

  async function refresh(): Promise<void> {
    hud.value = await window.standUp.getWellnessHud()
  }

  onMounted(() => {
    refresh()
    unsubscribe = window.standUp.onWellnessHudChange((next) => {
      hud.value = next
    })
  })

  onUnmounted(() => {
    unsubscribe?.()
  })

  return { hud, refresh }
}

export function formatHudCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
