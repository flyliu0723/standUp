<template>
  <span class="status-badge" :class="badgeClass">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WorkState } from '@/types/session'

const props = defineProps<{
  state: WorkState
  isPaused?: boolean
}>()

const LABEL: Record<WorkState, string> = {
  offDuty: '未上班',
  sitting: '久坐中',
  standing: '休息中',
  away: '离座中',
  paused: '已暂停'
}

const label = computed(() => {
  if (props.isPaused || props.state === 'paused') {
    return '已暂停'
  }
  return LABEL[props.state]
})

const badgeClass = computed(() => {
  if (props.isPaused || props.state === 'paused') {
    return 'status-badge--paused'
  }
  return `status-badge--${props.state}`
})
</script>

<style lang="scss" scoped>
.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;

  &--offDuty {
    background: #f1f5f9;
    color: #64748b;
  }

  &--sitting {
    background: #fff0f0;
    color: #ff4d4f;
  }

  &--standing {
    background: #f0fdf4;
    color: #16a34a;
  }

  &--away {
    background: #eff6ff;
    color: #2563eb;
  }

  &--paused {
    background: #fef3c7;
    color: #d97706;
  }
}
</style>
