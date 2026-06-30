<template>
  <div class="toast">
    <div class="toast__card">
      <div class="toast__header">
        <span class="toast__emoji">👋</span>
        <span class="toast__title">{{ copy.tag }}</span>
      </div>
      <p class="toast__body">{{ copy.title }}</p>
      <p class="toast__hint">
        保持不操作 {{ idleProgress.remainingSeconds }} 秒后自动判定起身
      </p>
      <div class="toast__actions">
        <button class="toast__btn toast__btn--ghost" :disabled="loading" @click="handleSnooze">
          延后 {{ snoozeMinutes }} 分钟
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { ReminderCopyPayload, ReminderIdleProgress } from '@/types/session'

const DEFAULT_COPY: ReminderCopyPayload = {
  tag: 'standUp',
  title: '该起来活动了',
  subtitle: ''
}

const DEFAULT_IDLE: ReminderIdleProgress = {
  idleSeconds: 0,
  requiredSeconds: 30,
  remainingSeconds: 30,
  progress: 0,
  unlocked: false
}

const sitMinutes = ref(40)
const snoozeMinutes = ref(10)
const loading = ref(false)
const copy = ref<ReminderCopyPayload>({ ...DEFAULT_COPY })
const idleProgress = ref<ReminderIdleProgress>({ ...DEFAULT_IDLE })

let unsubscribeMinutes: (() => void) | null = null
let unsubscribeCopy: (() => void) | null = null
let unsubscribeIdle: (() => void) | null = null
let idlePollTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  sitMinutes.value = await window.standUp.getReminderMinutes()
  const settings = await window.standUp.getSettings()
  snoozeMinutes.value = settings.snoozeMinutes

  const fetchedCopy = await window.standUp.getReminderCopy()
  if (fetchedCopy) {
    copy.value = fetchedCopy
  }
  idleProgress.value = await window.standUp.getReminderIdleProgress()

  unsubscribeMinutes = window.standUp.onReminderMinutes((minutes) => {
    sitMinutes.value = minutes
  })

  unsubscribeCopy = window.standUp.onReminderCopy((next) => {
    copy.value = next
  })

  unsubscribeIdle = window.standUp.onReminderIdleProgress((next) => {
    idleProgress.value = next
  })

  idlePollTimer = setInterval(async () => {
    idleProgress.value = await window.standUp.getReminderIdleProgress()
  }, 1000)
})

onUnmounted(() => {
  unsubscribeMinutes?.()
  unsubscribeCopy?.()
  unsubscribeIdle?.()
  if (idlePollTimer) {
    clearInterval(idlePollTimer)
    idlePollTimer = null
  }
})

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
  margin: 0 0 8px;
  font-size: 13px;
  color: #e2e8f0;
  line-height: 1.45;
}

.toast__hint {
  margin: 0 0 14px;
  font-size: 12px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
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

.toast__btn--ghost {
  background: rgba(148, 163, 184, 0.15);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.25);
}
</style>
