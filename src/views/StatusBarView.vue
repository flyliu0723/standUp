<template>
  <button
    class="wellness-bar"
    :class="barClass"
    type="button"
    :title="tooltip"
    @click="openMain"
  >
    <div class="wellness-bar__body-track" aria-hidden="true">
      <div class="wellness-bar__body-fill" :class="bodyFillClass" :style="bodyFillStyle" />
    </div>

    <div class="wellness-bar__content">
      <div class="wellness-bar__mind" aria-hidden="true" title="精神负载波形">
        <svg class="wellness-bar__wave" viewBox="0 0 32 12" preserveAspectRatio="none">
          <polyline :points="wavePoints" />
        </svg>
        <span class="wellness-bar__mind-value">{{ hud.mindLoad }}</span>
      </div>

      <div v-if="hud.mode === 'breathing'" class="wellness-bar__breath" aria-hidden="true">
        <span class="wellness-bar__breath-ring" />
        <span class="wellness-bar__breath-core" />
      </div>

      <div class="wellness-bar__text">
        <span class="wellness-bar__action">{{ displayAction }}</span>
        <span v-if="displayDetail && !isVertical" class="wellness-bar__detail">{{ displayDetail }}</span>
      </div>

      <span v-if="showCountdown" class="wellness-bar__countdown">{{ countdownText }}</span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { formatHudCountdown, useWellnessHud } from '@/composables/useWellnessHud'
import { useStatusBarLayout } from '@/composables/useStatusBarLayout'

const { hud } = useWellnessHud()
const { orientation, edge } = useStatusBarLayout()

const isVertical = computed(() => orientation.value === 'vertical')

const barClass = computed(() => [
  `wellness-bar--${hud.value.mode}`,
  isVertical.value ? 'wellness-bar--vertical' : 'wellness-bar--horizontal',
  isVertical.value && edge.value === 'right' ? 'wellness-bar--edge-right' : '',
  isVertical.value && edge.value === 'left' ? 'wellness-bar--edge-left' : '',
  hud.value.bodyTier !== 'neutral' ? `wellness-bar--body-${hud.value.bodyTier}` : ''
])

const bodyFillClass = computed(() => `wellness-bar__body-fill--${hud.value.bodyTier}`)

const bodyFillStyle = computed(() => {
  const percent = `${Math.round(hud.value.bodyProgress * 100)}%`
  return isVertical.value ? { height: percent } : { width: percent }
})

const wavePoints = computed(() => {
  const values = hud.value.mindWaveform
  if (!values.length) {
    return '0,6 32,6'
  }
  const step = 32 / Math.max(1, values.length - 1)
  return values
    .map((value, index) => {
      const x = index * step
      const y = 11 - value * 9
      return `${x},${y}`
    })
    .join(' ')
})

const displayAction = computed(() => {
  if (hud.value.mode === 'mental_oom') {
    return '线程交织过载 🧠'
  }
  return hud.value.actionText
})

const displayDetail = computed(() => {
  if (hud.value.mode === 'mental_oom') {
    return '建议闭眼 30 秒'
  }
  if (hud.value.mode === 'breathing') {
    return '跟着光圈深呼吸'
  }
  if (hud.value.mode === 'phase_break') {
    return '顺势站立 1 分钟'
  }
  if (hud.value.countdownMs > 0 && hud.value.actionDetail) {
    return hud.value.actionDetail
  }
  return hud.value.actionDetail || ''
})

const showCountdown = computed(
  () => hud.value.mode === 'normal' && hud.value.countdownMs > 0
)

const countdownText = computed(() => {
  if (!showCountdown.value) {
    return ''
  }
  const time = formatHudCountdown(hud.value.countdownMs)
  if (isVertical.value) {
    return time
  }
  const verb = hud.value.bodyTier === 'orange' || hud.value.bodyTier === 'yellow' ? '换脑拉伸' : ''
  return verb ? `${time} · ${verb}` : time
})

const tooltip = computed(() => {
  const parts = [displayAction.value]
  if (displayDetail.value) {
    parts.push(displayDetail.value)
  }
  if (showCountdown.value) {
    parts.push(formatHudCountdown(hud.value.countdownMs))
  }
  parts.push(`精神负载 ${hud.value.mindLoad}`)
  parts.push('点击打开主面板')
  return parts.join(' · ')
})

function openMain(): void {
  window.standUp.openMainWindow()
}

function applyTransparentSurface(): void {
  document.documentElement.classList.add('ambient-surface')
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
  const appEl = document.getElementById('app')
  if (appEl) {
    appEl.style.background = 'transparent'
    appEl.style.backgroundImage = 'none'
  }
}

function resetTransparentSurface(): void {
  document.documentElement.classList.remove('ambient-surface')
  document.documentElement.style.background = ''
  document.body.style.background = ''
  const appEl = document.getElementById('app')
  if (appEl) {
    appEl.style.background = ''
    appEl.style.backgroundImage = ''
  }
}

onMounted(() => {
  applyTransparentSurface()
})

onUnmounted(() => {
  resetTransparentSurface()
})
</script>

<style lang="scss">
html.ambient-surface,
html.ambient-surface body,
html.ambient-surface #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent !important;
  background-image: none !important;
}
</style>

<style lang="scss" scoped>
.wellness-bar {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0;
  box-sizing: border-box;
  appearance: none;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    rgba(30, 41, 59, 0.92) 0%,
    rgba(15, 23, 42, 0.96) 100%
  );
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  color: #e2e8f0;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  user-select: none;
  overflow: hidden;
  transition: border-color 0.35s ease, box-shadow 0.35s ease;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);

  &:hover {
    border-color: rgba(148, 163, 184, 0.42);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.24);
  }

  &:active {
    opacity: 0.94;
  }
}

.wellness-bar__body-track {
  position: absolute;
  top: 0;
  left: 12px;
  right: 12px;
  height: 2px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.12);
  overflow: hidden;
}

.wellness-bar__body-fill {
  height: 100%;
  width: 0;
  border-radius: inherit;
  transition: width 0.8s ease, height 0.8s ease, background 0.5s ease;

  &--neutral {
    background: rgba(100, 116, 139, 0.35);
  }

  &--green {
    background: linear-gradient(90deg, #22c55e, #4ade80);
  }

  &--yellow {
    background: linear-gradient(90deg, #eab308, #fbbf24);
  }

  &--orange {
    background: linear-gradient(90deg, #f97316, #fb923c);
  }
}

.wellness-bar__content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 8px;
  min-height: 0;
  flex: 1;
}

.wellness-bar__mind {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  width: 44px;
}

.wellness-bar__wave {
  width: 28px;
  height: 12px;

  polyline {
    fill: none;
    stroke: #7dd3fc;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.85;
  }
}

.wellness-bar__mind-value {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: rgba(125, 211, 252, 0.75);
  min-width: 14px;
}

.wellness-bar__breath {
  position: relative;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.wellness-bar__breath-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1.5px solid rgba(129, 140, 248, 0.55);
  animation: breath-ring 11s ease-in-out infinite;
}

.wellness-bar__breath-core {
  position: absolute;
  inset: 6px;
  border-radius: 50%;
  background: rgba(129, 140, 248, 0.35);
  animation: breath-core 11s ease-in-out infinite;
}

.wellness-bar__text {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
}

.wellness-bar__action {
  font-weight: 600;
  color: #f1f5f9;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wellness-bar__detail {
  font-weight: 400;
  color: rgba(226, 232, 240, 0.68);
  overflow: hidden;
  text-overflow: ellipsis;

  &::before {
    content: '·';
    margin-right: 4px;
    color: rgba(148, 163, 184, 0.45);
  }
}

.wellness-bar__countdown {
  flex-shrink: 0;
  font-family: var(--font-display);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 12px;
  color: #fde047;
  letter-spacing: 0.02em;
}

.wellness-bar--mental_oom {
  border-color: rgba(125, 211, 252, 0.38);
  background: linear-gradient(
    180deg,
    rgba(30, 58, 88, 0.94) 0%,
    rgba(22, 45, 72, 0.97) 100%
  );

  .wellness-bar__action {
    color: #bae6fd;
  }

  .wellness-bar__wave polyline {
    stroke: #38bdf8;
    animation: wave-jitter 0.8s ease-in-out infinite alternate;
  }
}

.wellness-bar--breathing {
  border-color: rgba(129, 140, 248, 0.35);
  background: linear-gradient(
    180deg,
    rgba(36, 38, 72, 0.93) 0%,
    rgba(24, 26, 52, 0.96) 100%
  );

  .wellness-bar__action {
    color: #c7d2fe;
  }

  .wellness-bar__countdown {
    display: none;
  }
}

.wellness-bar--phase_break {
  border-color: rgba(251, 146, 60, 0.42);
  background: linear-gradient(
    180deg,
    rgba(68, 38, 22, 0.93) 0%,
    rgba(48, 26, 14, 0.96) 100%
  );
  animation: phase-glow 3s ease-in-out infinite;

  .wellness-bar__action {
    color: #fed7aa;
  }

  .wellness-bar__detail {
    color: rgba(254, 215, 170, 0.8);
  }
}

.wellness-bar--body-yellow {
  .wellness-bar__countdown {
    color: #fbbf24;
  }
}

.wellness-bar--body-orange {
  border-color: rgba(249, 115, 22, 0.4);

  .wellness-bar__countdown {
    color: #fb923c;
  }

  .wellness-bar__action {
    color: #ffedd5;
  }
}

@keyframes breath-ring {
  0%,
  100% {
    transform: scale(0.72);
    opacity: 0.45;
  }

  36% {
    transform: scale(1);
    opacity: 1;
  }

  64% {
    transform: scale(1);
    opacity: 0.9;
  }
}

@keyframes breath-core {
  0%,
  100% {
    transform: scale(0.6);
    opacity: 0.35;
  }

  36% {
    transform: scale(1);
    opacity: 0.75;
  }

  64% {
    transform: scale(1);
    opacity: 0.65;
  }
}

@keyframes wave-jitter {
  from {
    stroke-width: 1.5;
    opacity: 0.7;
  }

  to {
    stroke-width: 2.2;
    opacity: 1;
  }
}

@keyframes phase-glow {
  0%,
  100% {
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  }

  50% {
    box-shadow: 0 2px 14px rgba(251, 146, 60, 0.28);
  }
}

.wellness-bar--vertical {
  flex-direction: row;
  justify-content: center;
  align-items: center;

  .wellness-bar__body-track {
    top: 10px;
    bottom: 10px;
    left: 0;
    right: auto;
    width: 2px;
    height: auto;
  }

  .wellness-bar__body-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 0;

    &--green {
      background: linear-gradient(180deg, #22c55e, #4ade80);
    }

    &--yellow {
      background: linear-gradient(180deg, #eab308, #fbbf24);
    }

    &--orange {
      background: linear-gradient(180deg, #f97316, #fb923c);
    }
  }

  .wellness-bar__content {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 448px;
    height: 34px;
    flex: none;
    transform: translate(-50%, -50%) rotate(-90deg);
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 12px;
    text-align: left;
  }

  &.wellness-bar--edge-right .wellness-bar__content {
    transform: translate(-50%, -50%) rotate(90deg);
  }

  .wellness-bar__text {
    flex-direction: row;
    align-items: center;
    white-space: nowrap;
  }

  .wellness-bar__action {
    font-size: 11px;
  }

  .wellness-bar__countdown {
    font-size: 11px;
  }
}
</style>
