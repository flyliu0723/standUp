<template>
  <div class="dashboard">
    <section class="dashboard__hero">
      <div class="dashboard__hero-top">
        <div class="dashboard__hero-status">
          <StatusBadge :state="status.state" :is-paused="status.isPaused" />
          <p class="dashboard__hint">{{ stateHint }}</p>
        </div>
        <p
          v-if="status.state === 'sitting'"
          class="dashboard__sit-time"
        >
          {{ formatMs(status.currentSitMs) }}
        </p>
        <p
          v-else-if="status.state === 'standing'"
          class="dashboard__sit-time dashboard__sit-time--stand"
        >
          {{ formatMs(status.currentStandMs) }}
        </p>
      </div>

      <div class="dashboard__hero-body">
        <CyberPlant
          :level="gamification.level"
          :streak-days="gamification.streakDays"
          :total-breaks="gamification.totalBreaks"
          :work-state="status.state"
          :current-sit-ms="status.currentSitMs"
        />
      </div>

      <div class="dashboard__actions">
        <template v-for="action in actions" :key="action.key">
          <RippleButton
            v-if="action.primary"
            class="dashboard__btn"
            :class="action.primary ? 'dashboard__btn--primary' : 'dashboard__btn--default'"
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
        <span class="dashboard__shortcut">快捷键 Ctrl+Alt+S</span>
      </div>
    </section>

    <section class="dashboard__stats">
      <h3>今日概览</h3>
      <div class="dashboard__cards">
        <StatCard label="总坐时" :value="formatMs(stats.totalSitMs)" highlight>
          <template #footer>
            <MiniDayBar :sessions="stats.sessions" :date="stats.date" />
          </template>
        </StatCard>
        <StatCard label="休息次数" :value="`${stats.breakCount} 次`">
          <template #footer>
            <Sparkline :values="weeklyBreakCounts" />
          </template>
        </StatCard>
        <StatCard label="推迟提醒" :value="`${stats.snoozeCount || 0} 次`" />
        <StatCard label="上班开始" :value="workStartText" />
      </div>
    </section>

    <section class="dashboard__tip">
      <p>{{ dailyTip }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NButton } from 'naive-ui'
import StatusBadge from '@/components/StatusBadge.vue'
import StatCard from '@/components/StatCard.vue'
import CyberPlant from '@/components/CyberPlant.vue'
import MiniDayBar from '@/components/MiniDayBar.vue'
import Sparkline from '@/components/Sparkline.vue'
import RippleButton from '@/components/RippleButton.vue'
import { formatMs, formatTime, toDateString } from '@/utils/format'
import { useSessionStatus } from '@/composables/useSessionStatus'
import type { DailyStats, GamificationState, ReportSummary } from '@/types/session'

const { status } = useSessionStatus(1000)

const stats = ref<DailyStats>({
  date: '',
  totalSitMs: 0,
  breakCount: 0,
  longestSitMs: 0,
  snoozeCount: 0,
  snoozes: [],
  sessions: []
})

const gamification = ref<GamificationState>({
  growthPoints: 0,
  level: 1,
  streakDays: 0,
  lastBreakDate: '',
  totalBreaks: 0
})

const summary = ref<ReportSummary>({
  weekly: [],
  monthly: [],
  insight: null,
  weekBreakTotal: 0,
  weekSitMs: 0,
  monthBreakTotal: 0,
  savedSitMs: 0,
  goalAchievementRate7: 0,
  goalAchievementRate30: 0,
  personalPercentile: 0,
  personalPercentileMessage: ''
})

let unsubscribe: (() => void) | null = null

const TIPS = [
  '接杯水、眺望远处，眼睛也需要休息。',
  '站起来伸个懒腰，脊椎会感谢你的。',
  '久坐一小时约等于抽两根烟的危害，记得多动。',
  '站立 2 分钟，血液循环会明显改善。',
  '今天也要好好照顾自己的身体。'
]

const workStartText = computed(() =>
  stats.value.workStartAt ? formatTime(stats.value.workStartAt) : '—'
)
const dailyTip = computed(() => TIPS[new Date().getDate() % TIPS.length])

const weeklyBreakCounts = computed(() => summary.value.weekly.map((d) => d.breakCount))

const stateHint = computed(() => {
  if (status.value.isPaused || status.value.state === 'paused') {
    return '所有计时已冻结，恢复后继续'
  }
  switch (status.value.state) {
    case 'offDuty':
      return '点击「上班」开始今日久坐追踪'
    case 'sitting':
      return '久坐倒计时进行中，到时将提醒起立'
    case 'standing':
      return '站立休息中，完成后点「坐下」继续工作'
    case 'away':
      return '检测到离座，计时已冻结，回来后将确认这段时间'
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
    list.push({ key: 'stand', label: '起立', primary: true, handler: () => window.standUp.standUp() })
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
  gap: 16px;
}

.dashboard__hero {
  @include glass-surface;
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-lg);
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dashboard__hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.dashboard__hint {
  margin: 10px 0 0;
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
}

.dashboard__sit-time {
  margin: 0;
  @include display-num;
  font-size: 36px;
  font-weight: 700;
  color: var(--color-state-sitting);
  flex-shrink: 0;
  line-height: 1.1;

  &--stand {
    color: var(--color-state-standing);
  }
}

.dashboard__hero-body {
  display: flex;
  justify-content: center;
}

.dashboard__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;

  :deep(.n-button) {
    border-radius: var(--radius-md);
  }
}

.dashboard__btn {
  min-width: 96px;
  padding: 0 20px;
  height: 40px;
  font-size: 14px;
  font-weight: 500;
}

.dashboard__btn--primary {
  background: #18a058;
  color: #fff;

  &:hover:not(.ripple-btn--disabled) {
    background: #36ad6a;
  }
}

.dashboard__shortcut {
  font-size: 12px;
  color: #94a3b8;
  margin-left: 4px;
}

.dashboard__stats h3 {
  margin: 0 0 12px;
  font-size: 15px;
  color: #334155;
  font-weight: 600;
}

.dashboard__cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.dashboard__tip {
  margin-top: 8px;
  padding: 14px 18px;
  border-radius: var(--radius-md);
  background: rgba(255, 251, 235, 0.85);
  border: 1px solid #fde68a;
  backdrop-filter: blur(8px);

  p {
    margin: 0;
    font-size: 13px;
    color: #92400e;
    line-height: 1.6;
  }
}
</style>
