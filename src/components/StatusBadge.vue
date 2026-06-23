<template>
  <span class="status-badge" :class="badgeClass">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WorkState } from '@/types/session'

const props = defineProps<{
  state: WorkState
  isPaused?: boolean
  isInactivePaused?: boolean
  reasonLabel?: string
}>()

const LABEL: Record<WorkState, string> = {
  offDuty: '未上班',
  sitting: '久坐中',
  standing: '休息中',
  away: '离座中',
  paused: '已暂停'
}

const label = computed(() => {
  if (props.reasonLabel) {
    return props.reasonLabel
  }
  if (props.isPaused || props.state === 'paused') {
    return '已暂停'
  }
  if (props.isInactivePaused && props.state === 'sitting') {
    return '输入暂停'
  }
  return LABEL[props.state]
})

const badgeClass = computed(() => {
  if (props.isPaused || props.state === 'paused') {
    return 'status-badge--paused'
  }
  if (props.isInactivePaused && props.state === 'sitting') {
    return 'status-badge--inactive'
  }
  return `status-badge--${props.state}`
})
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.status-badge {
  display: inline-block;
  padding: 5px 14px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  box-shadow: var(--shadow-sm);

  &--offDuty {
    background: #f1f5f9;
    color: #64748b;
  }

  &--sitting {
    background: #f0fdf4;
    color: #16a34a;
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

  &--inactive {
    background: #f8fafc;
    color: #64748b;
  }
}
</style>
