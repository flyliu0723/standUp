<template>
  <div class="overlay">
    <div class="overlay__edge overlay__edge--top" />
    <div class="overlay__edge overlay__edge--right" />
    <div class="overlay__edge overlay__edge--bottom" />
    <div class="overlay__edge overlay__edge--left" />

    <div class="overlay__banner">
      <p class="overlay__title">该起立了</p>
      <p class="overlay__sub">已连续工作 {{ sitMinutes }} 分钟</p>
      <div class="overlay__actions">
        <button class="overlay__btn overlay__btn--primary" :disabled="loading" @click="handleStand">
          立即起立
        </button>
        <button class="overlay__btn overlay__btn--ghost" :disabled="loading" @click="handleSnooze">
          延后 {{ snoozeMinutes }} 分钟
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const sitMinutes = ref(40)
const snoozeMinutes = ref(10)
const loading = ref(false)

let unsubscribeMinutes: (() => void) | null = null

onMounted(async () => {
  sitMinutes.value = await window.standUp.getReminderMinutes()
  const settings = await window.standUp.getSettings()
  snoozeMinutes.value = settings.snoozeMinutes

  unsubscribeMinutes = window.standUp.onReminderMinutes((minutes) => {
    sitMinutes.value = minutes
  })
})

onUnmounted(() => {
  unsubscribeMinutes?.()
})

async function handleStand(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    await window.standUp.confirmReminder()
  } finally {
    loading.value = false
  }
}

async function handleSnooze(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    await window.standUp.snoozeReminder()
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.overlay {
  width: 100vw;
  height: 100vh;
  position: relative;
  background: transparent;
  pointer-events: none;
  overflow: hidden;
}

.overlay__edge {
  position: absolute;
  pointer-events: none;
  animation: pulse-edge 2s ease-in-out infinite;

  &--top {
    top: 0;
    left: 0;
    right: 0;
    height: 12vh;
    background: linear-gradient(180deg, rgba(239, 68, 68, 0.35), transparent);
  }

  &--bottom {
    bottom: 0;
    left: 0;
    right: 0;
    height: 12vh;
    background: linear-gradient(0deg, rgba(239, 68, 68, 0.35), transparent);
  }

  &--left {
    top: 0;
    bottom: 0;
    left: 0;
    width: 8vw;
    background: linear-gradient(90deg, rgba(239, 68, 68, 0.28), transparent);
  }

  &--right {
    top: 0;
    bottom: 0;
    right: 0;
    width: 8vw;
    background: linear-gradient(270deg, rgba(239, 68, 68, 0.28), transparent);
  }
}

@keyframes pulse-edge {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

.overlay__banner {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
  padding: 16px 24px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.88);
  border: 1px solid rgba(248, 113, 113, 0.35);
  backdrop-filter: blur(12px);
  text-align: center;
  color: #f8fafc;
  box-shadow: 0 8px 32px rgba(239, 68, 68, 0.2);
}

.overlay__title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 700;
  color: #fca5a5;
}

.overlay__sub {
  margin: 0 0 12px;
  font-size: 13px;
  color: #94a3b8;
}

.overlay__actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.overlay__btn {
  padding: 8px 18px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}

.overlay__btn--primary {
  background: #ef4444;
  color: #fff;
}

.overlay__btn--ghost {
  background: rgba(148, 163, 184, 0.15);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.25);
}
</style>
