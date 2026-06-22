<template>
  <div class="toast">
    <div class="toast__card">
      <div class="toast__header">
        <span class="toast__emoji">👋</span>
        <span class="toast__title">该起来活动了</span>
      </div>
      <p class="toast__body">已连续工作 {{ sitMinutes }} 分钟</p>
      <div class="toast__actions">
        <button class="toast__btn toast__btn--primary" :disabled="loading" @click="handleStand">
          {{ loading ? '…' : '起立' }}
        </button>
        <button class="toast__btn toast__btn--ghost" :disabled="loading" @click="handleSnooze">
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
.toast {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0;
  box-sizing: border-box;
  background: transparent;
  animation: slide-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.toast__card {
  width: 100%;
  box-sizing: border-box;
  padding: 16px 18px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.25);
  backdrop-filter: blur(16px);
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.35);
  color: #f8fafc;
}

.toast__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.toast__emoji {
  font-size: 18px;
}

.toast__title {
  font-size: 16px;
  font-weight: 700;
}

.toast__body {
  margin: 0 0 14px;
  font-size: 13px;
  color: #94a3b8;
}

.toast__actions {
  display: flex;
  gap: 8px;
}

.toast__btn {
  flex: 1;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}

.toast__btn--primary {
  background: #22c55e;
  color: #fff;
}

.toast__btn--ghost {
  background: rgba(148, 163, 184, 0.15);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.25);
}
</style>
