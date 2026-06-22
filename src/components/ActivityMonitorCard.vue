<template>
  <section v-if="enabled" class="activity" :class="{ 'activity--embedded': embedded }">
    <div class="activity__head">
      <h3>活动监测</h3>
      <span class="activity__risk" :class="`activity__risk--${snapshot.neckRiskLevel}`">
        {{ riskLabel }}
      </span>
    </div>

    <div class="activity__grid">
      <div class="activity__item">
        <span class="activity__value">{{ snapshot.foregroundLabel || '—' }}</span>
        <span class="activity__label">当前应用</span>
      </div>
      <div class="activity__item">
        <span class="activity__value">{{ snapshot.continuousActiveMinutes }} 分</span>
        <span class="activity__label">连续活跃</span>
      </div>
      <div class="activity__item">
        <span class="activity__value">{{ snapshot.staticWorkIndex }}</span>
        <span class="activity__label">静止工作指数</span>
      </div>
      <div class="activity__item">
        <span class="activity__value">{{ snapshot.mouseRangeWidth }}×{{ snapshot.mouseRangeHeight }}</span>
        <span class="activity__label">鼠标范围(px)</span>
      </div>
      <div class="activity__item">
        <span class="activity__value">{{ snapshot.keyboardPerMinute }}/{{ snapshot.mousePerMinute }}</span>
        <span class="activity__label">键/鼠(次/分)</span>
      </div>
      <div class="activity__item">
        <span class="activity__value">{{ snapshot.windowSwitches5m }}/{{ snapshot.distinctApps5m }}</span>
        <span class="activity__label">5分钟切窗/应用</span>
      </div>
      <div class="activity__item">
        <span class="activity__value">{{ snapshot.clipboardOps5m }}</span>
        <span class="activity__label">5分钟剪贴板</span>
      </div>
      <div class="activity__item">
        <span class="activity__value">{{ snapshot.windowSwitches10m }}</span>
        <span class="activity__label">10分钟切窗</span>
      </div>
    </div>

    <p v-if="hint" class="activity__hint">{{ hint }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { ActivitySnapshot, AppSettings } from '@/types/session'

defineProps<{
  embedded?: boolean
}>()

const DEFAULT_SNAPSHOT: ActivitySnapshot = {
  foregroundApp: null,
  foregroundLabel: null,
  windowTitle: null,
  appCategory: 'neutral',
  keyboardPerMinute: 0,
  mousePerMinute: 0,
  mouseRangeWidth: 0,
  mouseRangeHeight: 0,
  windowSwitches10m: 0,
  windowSwitches5m: 0,
  distinctApps5m: 0,
  clipboardOps5m: 0,
  keyboardEvents15s: 0,
  continuousActiveMinutes: 0,
  staticWorkIndex: 0,
  neckRiskLevel: 'low',
  workMsToday: 0,
  entertainmentMsToday: 0,
  socialMsToday: 0,
  microActionCountToday: 0,
  isInputActive: false,
  idleMs: 0
}

const enabled = ref(true)
const snapshot = ref<ActivitySnapshot>({ ...DEFAULT_SNAPSHOT })

let pollTimer: ReturnType<typeof setInterval> | null = null

const riskLabel = computed(() => {
  switch (snapshot.value.neckRiskLevel) {
    case 'high':
      return '高风险'
    case 'medium':
      return '中风险'
    default:
      return '低风险'
  }
})

const hint = computed(() => {
  const s = snapshot.value
  if (s.neckRiskLevel === 'high') {
    return '⚠️ 长时间盯屏且活动范围小，建议转头或耸肩 3 秒'
  }
  if (s.appCategory === 'entertainment' && s.entertainmentMsToday > 60 * 60_000) {
    return '娱乐应用使用较久，同样需要注意颈椎'
  }
  if (s.microActionCountToday > 0) {
    return `今日已完成 ${s.microActionCountToday} 次微动作`
  }
  return ''
})

async function refresh(): Promise<void> {
  try {
    const settings: AppSettings = await window.standUp.getSettings()
    enabled.value = settings.enableActivityMonitor
    if (!enabled.value) {
      return
    }
    snapshot.value = await window.standUp.getActivitySnapshot()
  } catch {
    // 非 Electron 环境忽略
  }
}

onMounted(() => {
  refresh()
  pollTimer = setInterval(refresh, 5000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.activity {
  @include glass-surface;
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-lg);
  padding: 16px 18px;

  &--embedded {
    box-shadow: none;
    border-radius: 0;
    padding: 0;
    background: transparent;
  }
}

.activity__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  h3 {
    margin: 0;
    font-size: 14px;
    color: #64748b;
    font-weight: 600;
  }
}

.activity__risk {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;

  &--low {
    background: rgba(34, 197, 94, 0.12);
    color: #16a34a;
  }

  &--medium {
    background: rgba(245, 158, 11, 0.12);
    color: #d97706;
  }

  &--high {
    background: rgba(239, 68, 68, 0.12);
    color: #dc2626;
  }
}

.activity__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.activity__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.activity__value {
  @include display-num;
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity__label {
  font-size: 11px;
  color: #94a3b8;
}

.activity__hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}
</style>
