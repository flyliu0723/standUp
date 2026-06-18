<template>
  <div class="weekly-chart">
    <h4 class="weekly-chart__title">近 7 日休息次数</h4>
    <div class="weekly-chart__bars">
      <div v-for="day in data" :key="day.date" class="weekly-chart__col">
        <div class="weekly-chart__bar-wrap">
          <div
            class="weekly-chart__bar"
            :style="{ height: barHeight(day.breakCount) }"
            :title="`${day.label}: ${day.breakCount} 次`"
          />
        </div>
        <span class="weekly-chart__label">{{ day.label.split(' ')[1] || day.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WeeklyDayStat } from '@/types/session'

const props = defineProps<{
  data: WeeklyDayStat[]
}>()

const maxBreak = computed(() =>
  Math.max(1, ...props.data.map((d) => d.breakCount))
)

function barHeight(count: number): string {
  const pct = (count / maxBreak.value) * 100
  return `${Math.max(pct, count > 0 ? 8 : 0)}%`
}
</script>

<style lang="scss" scoped>
.weekly-chart {
  padding: 16px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  height: 100%;
  box-sizing: border-box;
}

.weekly-chart__title {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.weekly-chart__bars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 140px;
}

.weekly-chart__col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.weekly-chart__bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.weekly-chart__bar {
  width: 70%;
  min-height: 4px;
  background: linear-gradient(180deg, #60a5fa, #3b82f6);
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
}

.weekly-chart__label {
  margin-top: 8px;
  font-size: 11px;
  color: #94a3b8;
}
</style>
