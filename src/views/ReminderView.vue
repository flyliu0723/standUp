<template>
  <div class="reminder" :class="`reminder--${phase}`">
    <div v-if="phase === 'alert'" class="reminder__content">
      <p class="reminder__tag">{{ copy.tag }}</p>
      <h1 class="reminder__title">{{ copy.title }}</h1>
      <p class="reminder__subtitle">{{ copy.subtitle }}</p>

      <div class="reminder__unlock">
        <p class="reminder__unlock-label">
          {{ idleProgress.unlocked ? '已检测到离开，正在解除…' : '离开座位、保持不操作即可自动解除' }}
        </p>
        <p v-if="!idleProgress.unlocked" class="reminder__unlock-count">
          <span class="reminder__unlock-num">{{ idleProgress.remainingSeconds }}</span> 秒后自动判定为已起身
        </p>
        <div class="reminder__unlock-bar">
          <div
            class="reminder__unlock-fill"
            :class="{ 'reminder__unlock-fill--done': idleProgress.unlocked }"
            :style="{ width: `${Math.round(idleProgress.progress * 100)}%` }"
          />
        </div>
        <p class="reminder__unlock-meta">
          一旦碰键盘或鼠标，倒计时会重新开始
        </p>
      </div>

      <div class="reminder__actions">
        <button
          class="reminder__btn reminder__btn--secondary"
          :disabled="loading"
          @click="handleSnooze"
        >
          再坐 {{ snoozeMinutes }} 分钟
        </button>
      </div>
    </div>

    <div v-else class="reminder__content reminder__content--standing">
      <div class="reminder__activity">
        <div class="reminder__stretch-icon">{{ stretchEmoji }}</div>
        <div class="reminder__pulse-ring" />
      </div>
      <h1 class="reminder__title reminder__title--success">{{ currentStretch.name }}</h1>
      <p class="reminder__subtitle reminder__subtitle--stretch">{{ currentStretch.desc }}</p>
      <p class="reminder__countdown">已活动 {{ activitySeconds }} 秒</p>
      <div class="reminder__actions">
        <button class="reminder__btn reminder__btn--ghost" :disabled="loading" @click="shuffleStretch">
          换一个动作
        </button>
        <button
          class="reminder__btn reminder__btn--success"
          :disabled="loading"
          @click="handleSitDown"
        >
          {{ loading ? '处理中…' : '我坐下了' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { STRETCH_TIPS } from '@/constants/stretchTips'
import type { ReminderCopyPayload, ReminderIdleProgress } from '@/types/session'

type Phase = 'alert' | 'standing'

const DEFAULT_COPY: ReminderCopyPayload = {
  tag: 'standUp',
  title: '起来，该活动一下了。',
  subtitle: '离开座位即可解除提醒。'
}

const DEFAULT_IDLE: ReminderIdleProgress = {
  idleSeconds: 0,
  requiredSeconds: 30,
  remainingSeconds: 30,
  progress: 0,
  unlocked: false
}

const phase = ref<Phase>('alert')
const sitMinutes = ref(40)
const snoozeMinutes = ref(10)
const loading = ref(false)
const activitySeconds = ref(0)
const stretchIndex = ref(0)
const copy = ref<ReminderCopyPayload>({ ...DEFAULT_COPY })
const idleProgress = ref<ReminderIdleProgress>({ ...DEFAULT_IDLE })

const stretchEmojis = ['🧘', '💪', '🙆', '🚶', '🤸']

let unsubscribeMinutes: (() => void) | null = null
let unsubscribePhase: (() => void) | null = null
let unsubscribeCopy: (() => void) | null = null
let unsubscribeIdle: (() => void) | null = null
let idlePollTimer: ReturnType<typeof setInterval> | null = null
let activityTimer: ReturnType<typeof setInterval> | null = null
let activityStartAt = 0

const currentStretch = computed(() => STRETCH_TIPS[stretchIndex.value % STRETCH_TIPS.length])
const stretchEmoji = computed(() => stretchEmojis[stretchIndex.value % stretchEmojis.length])

function applyCopy(next: ReminderCopyPayload): void {
  copy.value = next
}

function applyIdleProgress(next: ReminderIdleProgress): void {
  idleProgress.value = next
}

function shuffleStretch(): void {
  stretchIndex.value = (stretchIndex.value + 1) % STRETCH_TIPS.length
}

function startActivityTimer(): void {
  activityStartAt = Date.now()
  activitySeconds.value = 0
  stretchIndex.value = Math.floor(Math.random() * STRETCH_TIPS.length)
  if (activityTimer) clearInterval(activityTimer)
  activityTimer = setInterval(() => {
    activitySeconds.value = Math.floor((Date.now() - activityStartAt) / 1000)
  }, 1000)
}

function stopActivityTimer(): void {
  if (activityTimer) {
    clearInterval(activityTimer)
    activityTimer = null
  }
}

function switchPhase(next: Phase): void {
  phase.value = next
  if (next === 'standing') {
    startActivityTimer()
  } else {
    stopActivityTimer()
  }
}

async function loadReminderContext(): Promise<void> {
  sitMinutes.value = await window.standUp.getReminderMinutes()
  const settings = await window.standUp.getSettings()
  snoozeMinutes.value = settings.snoozeMinutes

  const fetchedCopy = await window.standUp.getReminderCopy()
  if (fetchedCopy) {
    applyCopy(fetchedCopy)
  }

  applyIdleProgress(await window.standUp.getReminderIdleProgress())
}

onMounted(async () => {
  await loadReminderContext()

  unsubscribeMinutes = window.standUp.onReminderMinutes((minutes) => {
    sitMinutes.value = minutes
  })

  unsubscribePhase = window.standUp.onReminderPhase((p) => {
    switchPhase(p)
  })

  unsubscribeCopy = window.standUp.onReminderCopy((next) => {
    applyCopy(next)
  })

  unsubscribeIdle = window.standUp.onReminderIdleProgress((next) => {
    applyIdleProgress(next)
  })

  idlePollTimer = setInterval(async () => {
    if (phase.value !== 'alert') {
      return
    }
    applyIdleProgress(await window.standUp.getReminderIdleProgress())
  }, 1000)
})

onUnmounted(() => {
  unsubscribeMinutes?.()
  unsubscribePhase?.()
  unsubscribeCopy?.()
  unsubscribeIdle?.()
  if (idlePollTimer) {
    clearInterval(idlePollTimer)
    idlePollTimer = null
  }
  stopActivityTimer()
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

async function handleSitDown(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    await window.standUp.sitDownFromReminder()
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.reminder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  color: #f8fafc;
  user-select: none;
  transition: background 0.6s ease;

  &--alert {
    background: linear-gradient(145deg, #0f172a 0%, #1e293b 45%, #0f172a 100%);
  }

  &--standing {
    background: linear-gradient(145deg, #052e16 0%, #14532d 45%, #052e16 100%);
  }
}

.reminder__content {
  text-align: center;
  max-width: 720px;
  padding: 48px;
}

.reminder__tag {
  display: inline-block;
  margin: 0 0 24px;
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(248, 113, 113, 0.15);
  color: #fca5a5;
  font-size: 14px;
  letter-spacing: 0.08em;
}

.reminder__title {
  margin: 0 0 16px;
  font-size: clamp(32px, 5vw, 56px);
  font-weight: 700;
  line-height: 1.3;

  &--success {
    color: #86efac;
  }
}

.reminder__subtitle {
  margin: 0 0 32px;
  font-size: clamp(18px, 2.5vw, 28px);
  color: #94a3b8;

  &--stretch {
    font-size: clamp(16px, 2vw, 22px);
    color: #bbf7d0;
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
  }
}

.reminder__unlock {
  margin: 0 auto 32px;
  max-width: 420px;
  padding: 20px 24px;
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(248, 113, 113, 0.25);
}

.reminder__unlock-label {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #fecaca;
}

.reminder__unlock-count {
  margin: 0 0 12px;
  font-size: 15px;
  color: #e2e8f0;
}

.reminder__unlock-num {
  font-size: 28px;
  font-weight: 700;
  color: #4ade80;
  font-variant-numeric: tabular-nums;
}

.reminder__unlock-bar {
  height: 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
  overflow: hidden;
}

.reminder__unlock-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #f87171, #ef4444);
  transition: width 0.35s ease;

  &--done {
    background: linear-gradient(90deg, #4ade80, #22c55e);
  }
}

.reminder__unlock-meta {
  margin: 10px 0 0;
  font-size: 14px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.reminder__countdown {
  margin: 0 0 40px;
  font-size: 20px;
  color: #4ade80;
  font-variant-numeric: tabular-nums;
}

.reminder__actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.reminder__btn {
  width: min(360px, 80vw);
  padding: 18px 32px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 20px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}

.reminder__btn--secondary {
  background: rgba(148, 163, 184, 0.12);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.reminder__btn--ghost {
  background: transparent;
  color: #86efac;
  border: 1px solid rgba(134, 239, 172, 0.4);
  font-size: 16px;
  padding: 12px 24px;
}

.reminder__btn--success {
  background: #22c55e;
  color: #fff;
  box-shadow: 0 12px 40px rgba(34, 197, 94, 0.35);
}

.reminder__activity {
  position: relative;
  width: 160px;
  height: 160px;
  margin: 0 auto 32px;
}

.reminder__pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 3px solid rgba(74, 222, 128, 0.4);
  animation: pulse-ring 2s ease-out infinite;
}

.reminder__stretch-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 72px;
  animation: stretch-bounce 1s ease-in-out infinite alternate;
}

@keyframes stretch-bounce {
  from {
    transform: translateY(0) scale(1);
  }
  to {
    transform: translateY(-10px) scale(1.08);
  }
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.85);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.25);
    opacity: 0;
  }
}
</style>
