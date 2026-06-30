<template>
  <div class="ide-defer">
    <div class="ide-defer__card">
      <div class="ide-defer__header">
        <span class="ide-defer__emoji">💻</span>
        <span class="ide-defer__title">检测到 {{ ideLabel }} 编码中</span>
      </div>
      <p class="ide-defer__body">正在输入，要打断你吗？</p>
      <div class="ide-defer__countdown">
        <span class="ide-defer__countdown-num">{{ idleProgress.remainingSeconds }}</span>
        <span class="ide-defer__countdown-text">
          秒后自动判定为已起身（离开座位、保持不操作即可）
        </span>
      </div>
      <div class="ide-defer__bar">
        <div class="ide-defer__bar-fill" :style="{ width: `${Math.round(idleProgress.progress * 100)}%` }" />
      </div>
      <div class="ide-defer__actions">
        <button class="ide-defer__btn ide-defer__btn--primary" :disabled="loading" @click="handleDefer">
          延后 {{ snoozeMinutes }} 分钟
        </button>
        <button class="ide-defer__btn ide-defer__btn--ghost" :disabled="loading" @click="handleRemind">
          仍要提醒
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { ReminderIdleProgress } from '@/types/session'

const DEFAULT_IDLE: ReminderIdleProgress = {
  idleSeconds: 0,
  requiredSeconds: 30,
  remainingSeconds: 30,
  progress: 0,
  unlocked: false
}

const ideLabel = ref('IDE')
const snoozeMinutes = ref(10)
const loading = ref(false)
const idleProgress = ref<ReminderIdleProgress>({ ...DEFAULT_IDLE })

let unsubscribe: (() => void) | null = null
let unsubscribeIdle: (() => void) | null = null
let idlePollTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  unsubscribe = window.standUp.onIdeDeferContext((ctx) => {
    ideLabel.value = ctx.ideLabel
    snoozeMinutes.value = ctx.snoozeMinutes
  })

  idleProgress.value = await window.standUp.getReminderIdleProgress()
  unsubscribeIdle = window.standUp.onReminderIdleProgress((next) => {
    idleProgress.value = next
  })

  idlePollTimer = setInterval(async () => {
    idleProgress.value = await window.standUp.getReminderIdleProgress()
  }, 1000)
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribeIdle?.()
  if (idlePollTimer) {
    clearInterval(idlePollTimer)
    idlePollTimer = null
  }
})

async function handleDefer(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    await window.standUp.deferForIde()
  } finally {
    loading.value = false
  }
}

async function handleRemind(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    await window.standUp.forceReminder()
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.ide-defer {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
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

.ide-defer__card {
  width: 100%;
  box-sizing: border-box;
  padding: 16px 18px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(96, 165, 250, 0.35);
  backdrop-filter: blur(16px);
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.35);
  color: #f8fafc;
}

.ide-defer__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.ide-defer__emoji {
  font-size: 18px;
}

.ide-defer__title {
  font-size: 15px;
  font-weight: 700;
}

.ide-defer__body {
  margin: 0 0 10px;
  font-size: 13px;
  color: #94a3b8;
}

.ide-defer__countdown {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
}

.ide-defer__countdown-num {
  font-size: 22px;
  font-weight: 700;
  color: #60a5fa;
  font-variant-numeric: tabular-nums;
}

.ide-defer__countdown-text {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.3;
}

.ide-defer__bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
  overflow: hidden;
  margin-bottom: 14px;
}

.ide-defer__bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #60a5fa, #3b82f6);
  transition: width 0.35s ease;
}

.ide-defer__actions {
  display: flex;
  gap: 8px;
}

.ide-defer__btn {
  flex: 1;
  padding: 10px 12px;
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

.ide-defer__btn--primary {
  background: #3b82f6;
  color: #fff;
}

.ide-defer__btn--ghost {
  background: rgba(148, 163, 184, 0.15);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.25);
}
</style>
