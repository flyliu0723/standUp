<template>
  <div class="report" :class="{ 'report--embedded': embedded }">
    <header class="report__nav">
      <n-button quaternary circle @click="shiftDate(-1)">
        ‹
      </n-button>
      <span class="report__date">{{ dateLabel }}</span>
      <n-button quaternary circle :disabled="isToday" @click="shiftDate(1)">
        ›
      </n-button>
      <n-button v-if="!isToday" size="small" quaternary @click="goToday">
        今天
      </n-button>
    </header>

    <DayTimeline :sessions="stats.sessions" :date="currentDate" />

    <div class="report__middle">
      <TrendChart :weekly="summary.weekly" :monthly="summary.monthly" />
      <div class="report__achieve">
        <h4>核心成就</h4>
        <p class="report__achieve-value">{{ formatMs(summary.savedSitMs) }}</p>
        <p class="report__achieve-label">近 30 日免受久坐伤害时长</p>
        <p class="report__achieve-sub">
          本周起立 {{ summary.weekBreakTotal }} 次 · 达标率 {{ summary.goalAchievementRate7 }}%
        </p>
        <p class="report__achieve-sub">
          30 日达标率 {{ summary.goalAchievementRate30 }}%
        </p>
        <p v-if="summary.personalPercentileMessage" class="report__achieve-hint">
          {{ summary.personalPercentileMessage }}
        </p>
        <p class="report__achieve-sub">
          今日推迟提醒 {{ stats.snoozeCount || 0 }} 次
        </p>
      </div>
    </div>

    <div v-if="summary.insight" class="report__insight">
      <span class="report__insight-icon">💡</span>
      {{ summary.insight.message }}
    </div>

    <section v-if="snoozeTableData.length" class="report__detail">
      <h3>推迟记录</h3>
      <n-data-table
        class="report__table"
        :columns="snoozeColumns"
        :data="snoozeTableData"
        :bordered="false"
        size="small"
      />
    </section>

    <section class="report__detail report__detail--scroll">
      <h3>详细记录</h3>
      <n-data-table
        class="report__table"
        :columns="columns"
        :data="tableData"
        :bordered="false"
        size="small"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NDataTable, type DataTableColumns } from 'naive-ui'
import DayTimeline from '@/components/DayTimeline.vue'
import TrendChart from '@/components/TrendChart.vue'
import { formatMs, formatTime, toDateString } from '@/utils/format'
import type { DailyStats, ReportSummary } from '@/types/session'

defineProps<{
  embedded?: boolean
}>()

const stats = ref<DailyStats>({
  date: '',
  totalSitMs: 0,
  breakCount: 0,
  longestSitMs: 0,
  snoozeCount: 0,
  snoozes: [],
  sessions: []
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

const selectedTimestamp = ref(Date.now())

const currentDate = computed(() => toDateString(selectedTimestamp.value))

const isToday = computed(() => currentDate.value === toDateString(Date.now()))

const dateLabel = computed(() => {
  const d = new Date(selectedTimestamp.value)
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${weekDays[d.getDay()]}`
})

const columns: DataTableColumns = [
  { title: '开始', key: 'start' },
  { title: '结束', key: 'end' },
  { title: '时长', key: 'duration' },
  { title: '结束原因', key: 'reason' }
]

const reasonMap: Record<string, string> = {
  reminder: '提醒起立',
  manual: '手动起立',
  idle: '离开电脑',
  endWork: '下班',
  snooze: '推迟提醒',
  timeout: '站立达标',
  auto_idle: '离座判定起立'
}

const snoozeColumns: DataTableColumns = [
  { title: '时间', key: 'time' },
  { title: '推迟时长', key: 'minutes' },
  { title: '说明', key: 'note' }
]

const snoozeTableData = computed(() =>
  (stats.value.snoozes || []).map((s) => ({
    time: formatTime(s.at),
    minutes: `${s.minutes} 分钟`,
    note: '继续久坐，延后提醒'
  }))
)

const tableData = computed(() =>
  stats.value.sessions.map((s) => ({
    start: formatTime(s.startAt),
    end: s.endAt ? formatTime(s.endAt) : '—',
    duration: s.endAt ? formatMs(s.endAt - s.startAt) : '进行中',
    reason: s.endReason ? reasonMap[s.endReason] || s.endReason : '—'
  }))
)

function shiftDate(delta: number): void {
  const d = new Date(selectedTimestamp.value)
  d.setDate(d.getDate() + delta)
  if (d.getTime() > Date.now()) return
  selectedTimestamp.value = d.getTime()
}

function goToday(): void {
  selectedTimestamp.value = Date.now()
}

async function loadStats(): Promise<void> {
  const dateStr = currentDate.value
  stats.value = await window.standUp.getStatsByDate(dateStr)
  summary.value = await window.standUp.getReportSummary(dateStr)
}

watch(selectedTimestamp, () => {
  loadStats()
})

onMounted(() => {
  loadStats()
})
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.report {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;

  &--embedded {
    padding: 0;
    background: transparent;
  }
}

.report__nav {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.report__date {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  min-width: 180px;
  text-align: center;
}

.report__middle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  min-height: 220px;
  flex-shrink: 0;
}

.report__achieve {
  padding: 16px;
  border-radius: var(--radius-md);
  @include glass-surface;
  box-shadow: var(--shadow-card);
  background: linear-gradient(135deg, rgba(254, 242, 242, 0.85), rgba(255, 247, 237, 0.85));
  text-align: center;

  h4 {
    margin: 0 0 8px;
    font-size: 14px;
    color: #334155;
    font-weight: 600;
  }
}

.report__achieve-value {
  margin: 0;
  @include display-num;
  font-size: 32px;
  font-weight: 800;
  color: var(--color-state-sitting);
  line-height: 1.2;
}

.report__achieve-label {
  margin: 4px 0 0;
  font-size: 13px;
  color: #64748b;
}

.report__achieve-sub {
  margin: 10px 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.report__achieve-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #16a34a;
}

.report__insight {
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  @include glass-surface;
  box-shadow: var(--shadow-card);
  background: rgba(239, 246, 255, 0.85);
  font-size: 13px;
  color: #1e40af;
  line-height: 1.6;
  flex-shrink: 0;
}

.report__insight-icon {
  margin-right: 6px;
}

.report__detail {
  flex-shrink: 0;

  &--scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  h3 {
    margin: 0 0 8px;
    font-size: 14px;
    color: #334155;
    font-weight: 600;
  }
}

.report__table {
  border-radius: var(--radius-sm);
  overflow: hidden;

  :deep(.n-data-table-td) {
    padding: 12px 8px;
  }

  :deep(.n-data-table-th) {
    padding: 10px 8px;
  }
}
</style>
