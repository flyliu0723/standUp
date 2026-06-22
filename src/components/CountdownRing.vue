<template>
  <div class="countdown-ring" :class="[ringClass, `countdown-ring--${size}`]">
    <svg class="countdown-ring__svg" viewBox="0 0 120 120" aria-hidden="true">
      <circle class="countdown-ring__track" cx="60" cy="60" r="52" />
      <circle
        class="countdown-ring__progress"
        cx="60"
        cy="60"
        r="52"
        :stroke="strokeColor"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
      />
    </svg>
    <div class="countdown-ring__text">
      <span v-if="size === 'lg' && label" class="countdown-ring__sublabel">{{ label }}</span>
      <span class="countdown-ring__value">{{ countdownText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TimerMode, WorkState } from '@/types/session'
import { formatCountdown } from '@/composables/useSessionStatus'

const props = withDefaults(
  defineProps<{
    timerRemainingMs: number
    timerMode: TimerMode
    sitIntervalMinutes: number
    standIntervalMinutes: number
    timerTotalMs?: number
    workState: WorkState
    label?: string
    size?: 'sm' | 'lg'
  }>(),
  {
    size: 'sm'
  }
)

const RADIUS = 52
const circumference = 2 * Math.PI * RADIUS

const intervalMs = computed(() => {
  if (props.timerTotalMs && props.timerTotalMs > 0) {
    return props.timerTotalMs
  }
  const minutes =
    props.timerMode === 'stand' ? props.standIntervalMinutes : props.sitIntervalMinutes
  return Math.max(minutes * 60_000, 1)
})

const progress = computed(() =>
  Math.min(1, Math.max(0, props.timerRemainingMs / intervalMs.value))
)

const dashOffset = computed(() => circumference * (1 - progress.value))

const countdownText = computed(() => formatCountdown(props.timerRemainingMs))

const urgency = computed<'safe' | 'warning' | 'danger'>(() => {
  if (props.timerMode === 'stand') return 'safe'
  if (progress.value > 0.25) return 'safe'
  if (progress.value > 0.08) return 'warning'
  return 'danger'
})

const ringClass = computed(() => [
  props.timerMode === 'stand' ? 'countdown-ring--standing' : 'countdown-ring--sitting',
  `countdown-ring--${urgency.value}`
])

const strokeColor = computed(() => {
  const map = {
    safe: 'var(--color-health-safe)',
    warning: 'var(--color-health-warning)',
    danger: 'var(--color-health-danger)'
  }
  return map[urgency.value]
})
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.countdown-ring {
  position: relative;
  flex-shrink: 0;
}

.countdown-ring--sm {
  width: 52px;
  height: 52px;
}

.countdown-ring--lg {
  width: 160px;
  height: 160px;
}

.countdown-ring__svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.countdown-ring__track {
  fill: none;
  stroke: rgba(226, 232, 240, 0.9);
  stroke-width: 6;
}

.countdown-ring--sm .countdown-ring__track {
  stroke-width: 3;
}

.countdown-ring__progress {
  fill: none;
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear, stroke var(--duration-fast) var(--ease-out);
}

.countdown-ring--sm .countdown-ring__progress {
  stroke-width: 3;
}

.countdown-ring__text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  gap: 2px;
}

.countdown-ring__sublabel {
  font-size: 11px;
  color: #94a3b8;
  letter-spacing: 0.02em;
}

.countdown-ring__value {
  @include display-num;
  font-weight: 700;
  line-height: 1;
  color: var(--color-health-safe);
}

.countdown-ring--sm .countdown-ring__value {
  font-size: 11px;
}

.countdown-ring--lg .countdown-ring__value {
  font-size: 28px;
}

.countdown-ring--warning .countdown-ring__value {
  color: var(--color-health-warning);
}

.countdown-ring--danger .countdown-ring__value {
  color: var(--color-health-danger);
}

.countdown-ring--standing .countdown-ring__value {
  color: var(--color-health-safe);
}
</style>
