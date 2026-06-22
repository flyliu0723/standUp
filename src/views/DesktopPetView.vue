<template>
  <button class="pet" type="button" :title="tooltip" @click="openMain">
    <span class="pet__emoji" :class="{ 'pet__emoji--bounce': workState === 'standing' }">{{ emoji }}</span>
    <span v-if="countdown" class="pet__countdown">{{ countdown }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { formatCountdown, useSessionStatus } from '@/composables/useSessionStatus'

const { status } = useSessionStatus(1000)

const workState = computed(() => status.value.state)
const sitMinutes = computed(() => Math.floor(status.value.currentSitMs / 60_000))

const emoji = computed(() => {
  if (status.value.isPaused) return '😴'
  switch (status.value.state) {
    case 'offDuty':
      return '🌱'
    case 'standing':
      return '🌿'
    case 'away':
      return '💤'
    case 'sitting':
      if (sitMinutes.value >= 35) return '🥀'
      if (sitMinutes.value >= 20) return '🌱'
      return '🪴'
    default:
      return '🌱'
  }
})

const countdown = computed(() => {
  if (status.value.state !== 'sitting' && status.value.state !== 'standing') return ''
  if (status.value.timerMode === 'none') return ''
  const text = formatCountdown(status.value.timerRemainingMs)
  return text.replace(/^0:/, '')
})

const tooltip = computed(() => {
  switch (status.value.state) {
    case 'sitting':
      return `久坐中 · ${sitMinutes.value} 分钟 · 点击打开`
    case 'standing':
      return '休息中 · 点击打开'
    case 'away':
      return '离座中 · 点击打开'
    default:
      return 'standUp · 点击打开'
  }
})

function openMain(): void {
  window.standUp.openMainWindow()
}

onMounted(() => {
  document.body.style.background = 'transparent'
  document.documentElement.style.background = 'transparent'
})
</script>

<style lang="scss" scoped>
.pet {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0;
  border: none;
  background: rgba(255, 255, 255, 0.75);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.12);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
  }
}

.pet__emoji {
  font-size: 36px;
  line-height: 1;

  &--bounce {
    animation: pet-bounce 1.2s ease-in-out infinite;
  }
}

.pet__countdown {
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 700;
  color: #16a34a;
  font-variant-numeric: tabular-nums;
}

@keyframes pet-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
</style>
