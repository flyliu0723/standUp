<template>
  <div class="trend-chart">
    <div class="trend-chart__header">
      <div>
        <h4>{{ range === 7 ? '近 7 日趋势' : '近 30 日趋势' }}</h4>
        <p v-if="range === 7" class="trend-chart__insight">
          本周平均 <strong>{{ weekAvg }}</strong> 次/天
          <span v-if="weekDelta !== null" :class="deltaClass">
            · 较上周 {{ weekDelta >= 0 ? '↑' : '↓' }}{{ Math.abs(weekDelta) }}%
          </span>
        </p>
        <p v-else class="trend-chart__insight">
          30 日累计起立 <strong>{{ monthTotal }}</strong> 次
        </p>
      </div>
      <n-button-group size="tiny">
        <n-button :type="range === 7 ? 'primary' : 'default'" @click="range = 7">7 日</n-button>
        <n-button :type="range === 30 ? 'primary' : 'default'" @click="range = 30">30 日</n-button>
      </n-button-group>
    </div>
    <div class="trend-chart__canvas">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NButtonGroup } from 'naive-ui'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import type { RangeDayStat } from '@/types/session'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps<{
  weekly: RangeDayStat[]
  monthly: RangeDayStat[]
}>()

const range = ref<7 | 30>(7)

const activeData = computed(() => (range.value === 7 ? props.weekly : props.monthly))

const weekTotal = computed(() => props.weekly.reduce((s, d) => s + d.breakCount, 0))
const weekAvg = computed(() => {
  const days = props.weekly.length || 1
  return (weekTotal.value / days).toFixed(1)
})

const prevWeekTotal = computed(() => {
  if (props.monthly.length < 14) return null
  const prev = props.monthly.slice(-14, -7)
  return prev.reduce((s, d) => s + d.breakCount, 0)
})

const weekDelta = computed(() => {
  if (prevWeekTotal.value === null || prevWeekTotal.value === 0) return null
  const delta = ((weekTotal.value - prevWeekTotal.value) / prevWeekTotal.value) * 100
  return Math.round(delta)
})

const deltaClass = computed(() => {
  if (weekDelta.value === null) return ''
  return weekDelta.value >= 0 ? 'trend-chart__delta--up' : 'trend-chart__delta--down'
})

const monthTotal = computed(() => props.monthly.reduce((s, d) => s + d.breakCount, 0))

const chartData = computed(() => ({
  labels: activeData.value.map((d) => d.label.split(' ')[0]),
  datasets: [
    {
      label: '起立次数',
      data: activeData.value.map((d) => d.breakCount),
      backgroundColor: activeData.value.map((d) =>
        d.goalMet ? 'rgba(34, 197, 94, 0.8)' : 'rgba(148, 163, 184, 0.45)'
      ),
      borderRadius: 6
    }
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        afterLabel: (ctx: { dataIndex: number }) => {
          const day = activeData.value[ctx.dataIndex]
          return day?.goalMet ? '已达标 ✓' : '未达标'
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1, font: { size: 10 }, color: '#94a3b8' },
      grid: { color: '#f1f5f9' }
    },
    x: {
      ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0, color: '#94a3b8' },
      grid: { display: false }
    }
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.trend-chart {
  padding: 16px;
  border-radius: var(--radius-md);
  @include glass-surface;
  box-shadow: var(--shadow-card);
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.trend-chart__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;

  h4 {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 600;
    color: #334155;
  }
}

.trend-chart__insight {
  margin: 0;
  font-size: 12px;
  color: #64748b;

  strong {
    color: #16a34a;
    font-weight: 700;
  }
}

.trend-chart__delta--up {
  color: #16a34a;
  font-weight: 600;
}

.trend-chart__delta--down {
  color: #f59e0b;
  font-weight: 600;
}

.trend-chart__canvas {
  flex: 1;
  min-height: 180px;
  position: relative;
}
</style>
