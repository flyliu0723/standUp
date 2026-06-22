import { onMounted, onUnmounted, ref } from 'vue'
import type { StatusBarEdge, StatusBarLayoutInfo } from '@/types/session'

export function useStatusBarLayout() {
  const orientation = ref<'horizontal' | 'vertical'>('horizontal')
  const edge = ref<StatusBarEdge>('top')

  let unsubscribe: (() => void) | null = null

  function applyLayout(layout: StatusBarLayoutInfo): void {
    orientation.value = layout.orientation
    edge.value = layout.edge
  }

  onMounted(async () => {
    const settings = await window.standUp.getSettings()
    edge.value = settings.statusBarEdge
    orientation.value =
      settings.statusBarEdge === 'left' || settings.statusBarEdge === 'right' ? 'vertical' : 'horizontal'
    unsubscribe = window.standUp.onStatusBarLayout((layout) => {
      applyLayout(layout)
    })
  })

  onUnmounted(() => {
    unsubscribe?.()
  })

  return { orientation, edge }
}
