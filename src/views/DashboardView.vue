<template>
  <div class="dashboard">
    <section class="dashboard__hero">
      <div class="dashboard__hero-head">
        <StatusBadge
          :state="status.state"
          :is-paused="status.isPaused"
          :is-inactive-paused="status.isInactivePaused"
          :reason-label="statusBadgeLabel"
        />
        <span v-if="showTimer" class="dashboard__elapsed">
          已{{ status.state === 'standing' ? '活动' : '久坐' }}
          {{ formatMs(status.state === 'standing' ? status.currentStandMs : status.currentSitMs) }}
        </span>
      </div>

      <div v-if="showTimer" class="dashboard__countdown">
        <p class="dashboard__countdown-label">{{ countdownLabel }}</p>
        <CountdownRing
          size="lg"
          :label="countdownLabel"
          :timer-remaining-ms="status.timerRemainingMs"
          :timer-mode="status.timerMode"
          :sit-interval-minutes="status.sitIntervalMinutes"
          :stand-interval-minutes="status.standIntervalMinutes"
          :timer-total-ms="countdownTotalMs"
          :work-state="status.state"
        />
      </div>

      <div v-else class="dashboard__idle">
        <p class="dashboard__idle-icon">{{ idleIcon }}</p>
        <p class="dashboard__idle-text">{{ stateHint }}</p>
      </div>

      <div class="dashboard__actions">
        <template v-for="action in actions" :key="action.key">
          <RippleButton
            v-if="action.primary"
            class="dashboard__btn dashboard__btn--primary"
            :disabled="action.disabled"
            :ripple="!action.disabled"
            @click="action.handler"
          >
            {{ action.label }}
          </RippleButton>
          <n-button
            v-else
            size="large"
            :disabled="action.disabled"
            @click="action.handler"
          >
            {{ action.label }}
          </n-button>
        </template>
        <span class="dashboard__shortcut">Ctrl+Alt+S</span>
      </div>

      <StandReasonPicker
        :visible="showReasonPicker"
        @close="showReasonPicker = false"
        @select="handleStandReason"
      />

      <div class="dashboard__today">
        <div class="dashboard__today-item">
          <span class="dashboard__today-value">{{ formatMs(stats.totalSitMs) }}</span>
          <span class="dashboard__today-label">今日坐时</span>
        </div>
        <div class="dashboard__today-divider" />
        <div class="dashboard__today-item">
          <span class="dashboard__today-value">{{ stats.breakCount }} 次</span>
          <span class="dashboard__today-label">起立次数</span>
        </div>
        <div class="dashboard__today-divider" />
        <div class="dashboard__today-item">
          <span class="dashboard__today-value">{{ gamification.streakDays }} 天</span>
          <span class="dashboard__today-label">连续达标</span>
        </div>
      </div>
    </section>

    <LevelProgress :gamification="gamification" />

    <HealthScoreCard />

    <details class="dashboard__details">
      <summary>活动监测明细</summary>
      <ActivityMonitorCard embedded />
    </details>

    <ExecutionStats :execution="summary.execution" />

    <section class="dashboard__stats">
      <h3>今日详情</h3>
      <div class="dashboard__cards">
        <StatCard label="有效搬砖" :value="formatMs(summary.workMetrics.activeWorkMs)" />
        <StatCard label="离座时长" :value="formatMs(summary.workMetrics.awayMs)" />
        <StatCard label="推迟提醒" :value="`${stats.snoozeCount || 0} 次`" />
        <StatCard label="本周起立" :value="`${summary.weekBreakTotal} 次`">
          <template #footer>
            <Sparkline :values="weeklyBreakCounts" />
          </template>
        </StatCard>
      </div>
    </section>

    <InsightsBar :insights="summary.insights" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NButton } from 'naive-ui'
import StatusBadge from '@/components/StatusBadge.vue'
import StatCard from '@/components/StatCard.vue'
import CountdownRing from '@/components/CountdownRing.vue'
import LevelProgress from '@/components/LevelProgress.vue'
import Sparkline from '@/components/Sparkline.vue'
import RippleButton from '@/components/RippleButton.vue'
import ExecutionStats from '@/components/ExecutionStats.vue'
import InsightsBar from '@/components/InsightsBar.vue'
import StandReasonPicker from '@/components/StandReasonPicker.vue'
import ActivityMonitorCard from '@/components/ActivityMonitorCard.vue'
import HealthScoreCard from '@/components/HealthScoreCard.vue'
import { formatMs, formatTime, toDateString } from '@/utils/format'
import { createEmptyReportSummary } from '@/utils/reportDefaults'
import { useSessionStatus } from '@/composables/useSessionStatus'
import type { DailyStats, GamificationState, StandReasonId } from '@/types/session'

const { status } = useSessionStatus(1000)

const stats = ref<DailyStats>({
  date: '',
  totalSitMs: 0,
  breakCount: 0,
  longestSitMs: 0,
  snoozeCount: 0,
  snoozes: [],
  reminderTriggeredCount: 0,
  reminderOnTimeCount: 0,
  reminderDelayedCount: 0,
  reminderIgnoredCount: 0,
  sessions: []
})

const gamification = ref<GamificationState>({
  growthPoints: 0,
  level: 1,
  streakDays: 0,
  lastBreakDate: '',
  totalBreaks: 0
})

const summary = ref(createEmptyReportSummary())
const showReasonPicker = ref(false)

let unsubscribe: (() => void) | null = null

const workStartText = computed(() =>
  stats.value.workStartAt ? formatTime(stats.value.workStartAt) : '—'
)

const weeklyBreakCounts = computed(() => summary.value.weekly.map((d) => d.breakCount))

const showTimer = computed(() => {
  if (status.value.state === 'away') return false
  if (status.value.isPaused || status.value.state === 'paused') {
    return Boolean(status.value.pausedUntil)
  }
  if (status.value.isInactivePaused) return true
  return status.value.timerMode === 'sit' || status.value.timerMode === 'stand'
})

const statusBadgeLabel = computed(() => {
  if (status.value.pauseReasonLabel) {
    return status.value.pauseReasonLabel
  }
  if (status.value.standReasonLabel) {
    return status.value.standReasonLabel
  }
  return undefined
})

const countdownLabel = computed(() => {
  if (status.value.isPaused || status.value.state === 'paused') {
    return '距恢复计时'
  }
  return status.value.timerMode === 'stand' ? '距坐下提醒' : '距起立提醒'
})

const countdownTotalMs = computed(() => {
  if (status.value.isPaused || status.value.state === 'paused') {
    return status.value.pauseTimerTotalMs
  }
  return status.value.standTimerTotalMs
})

const idleIcon = computed(() => {
  if (status.value.isPaused || status.value.state === 'paused') return '⏸'
  if (status.value.state === 'away') return '🚶'
  return '☀️'
})

const stateHint = computed(() => {
  if (status.value.isPaused || status.value.state === 'paused') {
    if (status.value.pauseReasonLabel) {
      return `${status.value.pauseReasonLabel}中，计时已冻结`
    }
    return '计时已冻结，恢复后继续'
  }
  if (status.value.isInactivePaused && status.value.state === 'sitting') {
    return '无键鼠输入，久坐倒计时已暂停'
  }
  switch (status.value.state) {
    case 'offDuty':
      return '点击「上班」开始今日久坐追踪'
    case 'away':
      return '检测到离座，回来后将确认这段时间'
    default:
      return ''
  }
})

const actions = computed(() => {
  const s = status.value.state
  const list: {
    key: string
    label: string
    primary?: boolean
    disabled?: boolean
    handler: () => void
  }[] = []

  if (status.value.isPaused || status.value.state === 'paused') {
    list.push({
      key: 'resume',
      label: '恢复',
      primary: true,
      handler: () => window.standUp.resumePause()
    })
  }

  if (s === 'offDuty') {
    list.push({ key: 'start', label: '上班', primary: true, handler: () => window.standUp.startWork() })
  } else if (s === 'sitting') {
    list.push({
      key: 'stand',
      label: '立即起立',
      primary: true,
      handler: () => {
        showReasonPicker.value = true
      }
    })
    list.push({ key: 'end', label: '下班', handler: () => window.standUp.endWork() })
  } else if (s === 'standing') {
    list.push({ key: 'sit', label: '坐下', primary: true, handler: () => window.standUp.sitDown() })
    list.push({ key: 'end', label: '下班', handler: () => window.standUp.endWork() })
  } else if (s === 'away') {
    list.push({ key: 'away', label: '离座确认中…', disabled: true, handler: () => {} })
    list.push({ key: 'end', label: '下班', handler: () => window.standUp.endWork() })
  }

  return list
})

async function handleStandReason(reasonId: StandReasonId): Promise<void> {
  showReasonPicker.value = false
  await window.standUp.standUpWithReason(reasonId)
}

async function refreshData(): Promise<void> {
  const today = toDateString(Date.now())
  stats.value = await window.standUp.getTodayStats()
  gamification.value = await window.standUp.getGamification()
  summary.value = await window.standUp.getReportSummary(today)
}

onMounted(async () => {
  await refreshData()
  unsubscribe = window.standUp.onStateChange(() => {
    refreshData()
  })
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  max-width: 720px;
}

.dashboard__hero {
  @include elevated-surface;
  border-radius: var(--radius-lg);
  padding: var(--space-lg) var(--space-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.dashboard__hero-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.dashboard__elapsed {
  font-size: 12px;
  color: #94a3b8;
  @include display-num;
}

.dashboard__countdown {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.dashboard__countdown-label {
  margin: 0;
  font-size: 13px;
  color: #64748b;
  letter-spacing: 0.04em;
}

.dashboard__idle {
  text-align: center;
  padding: 24px 0;
}

.dashboard__idle-icon {
  margin: 0 0 8px;
  font-size: 40px;
  line-height: 1;
}

.dashboard__idle-text {
  margin: 0;
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
}

.dashboard__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  width: 100%;

  :deep(.n-button) {
    border-radius: var(--radius-md);
  }
}

.dashboard__btn {
  min-width: 120px;
  padding: 0 24px;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
}

.dashboard__btn--primary {
  background: var(--color-health-safe);
  color: #fff;

  &:hover:not(.ripple-btn--disabled) {
    background: #16a34a;
  }
}

.dashboard__shortcut {
  font-size: 11px;
  color: #cbd5e1;
}

.dashboard__today {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding-top: var(--space-md);
  gap: 0;
}

.dashboard__today-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: var(--space-sm) 0;
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(241, 245, 249, 0.6);
  }
}

.dashboard__today-value {
  @include display-num;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.dashboard__today-label {
  font-size: 11px;
  color: #94a3b8;
}

.dashboard__today-divider {
  width: 1px;
  height: 32px;
  background: var(--color-border-subtle);
  flex-shrink: 0;
  opacity: 0.6;
}

.dashboard__stats h3 {
  margin: var(--space-sm) 0 var(--space-sm);
  font-size: 13px;
  color: #94a3b8;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dashboard__cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-sm);
}

.dashboard__details {
  @include elevated-surface;
  border-radius: var(--radius-lg);
  padding: 0 var(--space-md) var(--space-sm);

  summary {
    cursor: pointer;
    padding: 14px 0;
    font-size: 13px;
    color: #64748b;
    font-weight: 600;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }
  }

  :deep(.activity) {
    box-shadow: none;
    border: none;
    padding: 0 0 8px;
    background: transparent;
  }
}
</style>
