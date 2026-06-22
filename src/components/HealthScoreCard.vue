<template>
  <section v-if="enabled" class="health">
    <div class="health__score-row">
      <div class="health__score-block">
        <p class="health__score-label">今日颈椎评分</p>
        <p class="health__score-value" :class="`health__score-value--${summary.neckRiskLevel}`">
          {{ summary.cervicalHealthScore }}
        </p>
        <span class="health__risk-badge" :class="`health__risk-badge--${summary.neckRiskLevel}`">
          {{ riskLabel }}
        </span>
      </div>

      <div class="health__focus-block">
        <p class="health__focus-label">当前状态</p>
        <p class="health__focus-value">{{ summary.workFocusLabel }}</p>
        <p v-if="summary.foregroundLabel" class="health__focus-sub">
          前台 · {{ summary.foregroundLabel }}
        </p>
      </div>
    </div>

    <p class="health__advice">{{ summary.healthAdvice }}</p>

    <div class="health__grid">
      <div class="health__item">
        <span class="health__item-value">{{ formatMs(summary.longestSitMs) }}</span>
        <span class="health__item-label">最长连续久坐</span>
      </div>
      <div class="health__item">
        <span class="health__item-value">{{ summary.continuousActiveMinutes }} 分</span>
        <span class="health__item-label">连续活跃</span>
      </div>
      <div class="health__item">
        <span class="health__item-value">{{ summary.microActionCountToday }} 次</span>
        <span class="health__item-label">微动作</span>
      </div>
      <div class="health__item">
        <span class="health__item-value">{{ summary.effectiveStandCount }} 次</span>
        <span class="health__item-label">有效起立</span>
      </div>
      <div class="health__item">
        <span class="health__item-value">{{ fatigueText }}</span>
        <span class="health__item-label">预计疲劳</span>
      </div>
      <div class="health__item">
        <span class="health__item-value">{{ highRiskText }}</span>
        <span class="health__item-label">高风险时段</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { AppSettings, DailyHealthSummary } from '@/types/session'
import { formatMs } from '@/utils/format'

const DEFAULT_SUMMARY: DailyHealthSummary = {
  cervicalHealthScore: 100,
  neckRiskLevel: 'low',
  workFocusState: 'neutral',
  workFocusLabel: '一般状态',
  healthAdvice: '开启活动监测后，这里会显示颈椎健康建议。',
  fatigueEstimateMinutes: null,
  longestSitMs: 0,
  currentContinuousSitMs: 0,
  microActionCountToday: 0,
  effectiveStandCount: 0,
  continuousActiveMinutes: 0,
  staticWorkIndex: 0,
  highRiskPeriodHint: '',
  workMsToday: 0,
  entertainmentMsToday: 0,
  socialMsToday: 0,
  foregroundLabel: null
}

const enabled = ref(true)
const summary = ref<DailyHealthSummary>({ ...DEFAULT_SUMMARY })

let pollTimer: ReturnType<typeof setInterval> | null = null

const riskLabel = computed(() => {
  switch (summary.value.neckRiskLevel) {
    case 'high':
      return '高风险'
    case 'medium':
      return '注意'
    default:
      return '安全'
  }
})

const fatigueText = computed(() => {
  const minutes = summary.value.fatigueEstimateMinutes
  if (minutes === null) return '—'
  if (minutes <= 0) return '已到'
  return `${minutes} 分钟后`
})

const highRiskText = computed(() => summary.value.highRiskPeriodHint || '—')

async function refresh(): Promise<void> {
  try {
    const settings: AppSettings = await window.standUp.getSettings()
    enabled.value = settings.enableActivityMonitor
    if (!enabled.value) {
      return
    }
    summary.value = await window.standUp.getDailyHealthSummary()
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

.health {
  @include glass-surface;
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-lg);
  padding: 18px 20px;
}

.health__score-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 14px;
}

.health__score-label,
.health__focus-label {
  margin: 0 0 6px;
  font-size: 12px;
  color: #94a3b8;
}

.health__score-value {
  margin: 0;
  @include display-num;
  font-size: 42px;
  font-weight: 800;
  line-height: 1;

  &--low {
    color: #16a34a;
  }

  &--medium {
    color: #d97706;
  }

  &--high {
    color: #dc2626;
  }
}

.health__risk-badge {
  display: inline-block;
  margin-top: 8px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;

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

.health__focus-value {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
}

.health__focus-sub {
  margin: 6px 0 0;
  font-size: 12px;
  color: #64748b;
}

.health__advice {
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(99, 102, 241, 0.08);
  color: #4338ca;
  font-size: 13px;
  line-height: 1.55;
}

.health__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.health__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.health__item-value {
  @include display-num;
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.health__item-label {
  font-size: 11px;
  color: #94a3b8;
}
</style>
