<template>
  <div class="trend-chart">
    <div class="trend-chart__header">
      <h4>{{ range === 7 ? '近 7 日趋势' : '近 30 日趋势' }}</h4>
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

const chartData = computed(() => ({
  labels: activeData.value.map((d) => d.label.split(' ')[0]),
  datasets: [
    {
      label: '起立次数',
      data: activeData.value.map((d) => d.breakCount),
      backgroundColor: activeData.value.map((d) =>
        d.goalMet ? 'rgba(34, 197, 94, 0.75)' : 'rgba(59, 130, 246, 0.7)'
      ),
      borderRadius: 4
    }
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { boxWidth: 12, font: { size: 11 } }
    },
    tooltip: {
      callbacks: {
        afterLabel: (ctx: { dataIndex: number }) => {
          const day = activeData.value[ctx.dataIndex]
          return day?.goalMet ? '已达标' : '未达标'
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1, font: { size: 10 } },
      grid: { color: '#f1f5f9' }
    },
    x: {
      ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0 },
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
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;

  h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #334155;
  }
}

.trend-chart__canvas {
  flex: 1;
  min-height: 180px;
  position: relative;
}
</style>
