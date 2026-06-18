<template>
  <div class="countdown-ring" :class="ringClass">
    <svg class="countdown-ring__svg" viewBox="0 0 52 52" aria-hidden="true">
      <circle class="countdown-ring__track" cx="26" cy="26" r="22" />
      <circle
        class="countdown-ring__progress"
        cx="26"
        cy="26"
        r="22"
        :stroke="strokeColor"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
      />
    </svg>
    <div class="countdown-ring__text">
      <span class="countdown-ring__label">{{ label }}</span>
      <span class="countdown-ring__value">{{ countdownText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TimerMode, WorkState } from '@/types/session'
import { formatCountdown } from '@/composables/useSessionStatus'

const props = defineProps<{
  timerRemainingMs: number
  timerMode: TimerMode
  sitIntervalMinutes: number
  standIntervalMinutes: number
  workState: WorkState
  label?: string
}>()

const RADIUS = 22
const circumference = 2 * Math.PI * RADIUS

const intervalMs = computed(() => {
  const minutes =
    props.timerMode === 'stand' ? props.standIntervalMinutes : props.sitIntervalMinutes
  return Math.max(minutes * 60_000, 1)
})

const progress = computed(() =>
  Math.min(1, Math.max(0, props.timerRemainingMs / intervalMs.value))
)

const dashOffset = computed(() => circumference * (1 - progress.value))

const countdownText = computed(() => formatCountdown(props.timerRemainingMs))

const ringClass = computed(() => {
  if (props.timerMode === 'stand') return 'countdown-ring--standing'
  return 'countdown-ring--sitting'
})

const strokeColor = computed(() => {
  const isLow = progress.value < 0.1
  if (props.timerMode === 'stand') {
    return isLow ? '#16a34a' : '#22c55e'
  }
  return isLow ? '#dc2626' : '#ef4444'
})
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.countdown-ring {
  position: relative;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
}

.countdown-ring__svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.countdown-ring__track {
  fill: none;
  stroke: rgba(226, 232, 240, 0.9);
  stroke-width: 3;
}

.countdown-ring__progress {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear, stroke var(--duration-fast) var(--ease-out);
}

.countdown-ring__text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.countdown-ring__label {
  display: none;
}

.countdown-ring__value {
  @include display-num;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  color: var(--color-state-sitting);
}

.countdown-ring--standing .countdown-ring__value {
  color: var(--color-state-standing);
}
</style>
