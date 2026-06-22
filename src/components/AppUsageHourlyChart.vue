<template>
  <section class="usage-hourly">
    <div class="usage-hourly__head">
      <h3>按小时分布</h3>
      <span class="usage-hourly__hint">工作 / 娱乐 / 社交 / 其他</span>
    </div>

    <div v-if="hasData" class="usage-hourly__canvas">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
    <p v-else class="usage-hourly__empty">暂无按小时数据</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import type { AppUsageDailySummary } from '@/types/session'
import { APP_CATEGORY_COLORS, formatUsageDuration } from '@/utils/appUsage'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps<{
  summary: AppUsageDailySummary
}>()

const hasData = computed(() => props.summary.hourlyBuckets.length > 0)

const chartData = computed(() => ({
  labels: props.summary.hourlyBuckets.map((bucket) => bucket.label),
  datasets: [
    {
      label: '工作',
      data: props.summary.hourlyBuckets.map((bucket) => roundMinutes(bucket.workMs)),
      backgroundColor: APP_CATEGORY_COLORS.work,
      borderRadius: 4,
      stack: 'usage'
    },
    {
      label: '娱乐',
      data: props.summary.hourlyBuckets.map((bucket) => roundMinutes(bucket.entertainmentMs)),
      backgroundColor: APP_CATEGORY_COLORS.entertainment,
      borderRadius: 4,
      stack: 'usage'
    },
    {
      label: '社交',
      data: props.summary.hourlyBuckets.map((bucket) => roundMinutes(bucket.socialMs)),
      backgroundColor: APP_CATEGORY_COLORS.social,
      borderRadius: 4,
      stack: 'usage'
    },
    {
      label: '其他',
      data: props.summary.hourlyBuckets.map((bucket) => roundMinutes(bucket.neutralMs)),
      backgroundColor: APP_CATEGORY_COLORS.neutral,
      borderRadius: 4,
      stack: 'usage'
    }
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        boxWidth: 10,
        boxHeight: 10,
        font: { size: 11 },
        color: '#64748b'
      }
    },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) => {
          const minutes = ctx.parsed.y
          return `${ctx.dataset.label}: ${formatUsageDuration(minutes * 60_000)}`
        }
      }
    }
  },
  scales: {
    x: {
      stacked: true,
      ticks: { font: { size: 10 }, color: '#94a3b8' },
      grid: { display: false }
    },
    y: {
      stacked: true,
      beginAtZero: true,
      ticks: {
        font: { size: 10 },
        color: '#94a3b8',
        callback: (value: number | string) => `${value}m`
      },
      grid: { color: '#f1f5f9' }
    }
  }
}

function roundMinutes(ms: number): number {
  return Math.max(0, Math.round(ms / 60_000))
}
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.usage-hourly {
  @include glass-surface;
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-lg);
  padding: 16px 18px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.usage-hourly__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;

  h3 {
    margin: 0;
    font-size: 14px;
    color: #64748b;
    font-weight: 600;
  }
}

.usage-hourly__hint {
  font-size: 11px;
  color: #94a3b8;
}

.usage-hourly__canvas {
  flex: 1;
  min-height: 220px;
  position: relative;
}

.usage-hourly__empty {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}
</style>
