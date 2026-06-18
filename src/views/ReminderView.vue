<template>
  <div class="reminder" :class="`reminder--${phase}`">
    <div v-if="phase === 'alert'" class="reminder__content">
      <p class="reminder__tag">standUp</p>
      <h1 class="reminder__title">起来，你已经连续坐了 {{ sitMinutes }} 分钟。</h1>
      <p class="reminder__subtitle">去接杯水再回来。</p>
      <div class="reminder__actions">
        <button
          class="reminder__btn reminder__btn--primary"
          :disabled="loading"
          @click="handleConfirm"
        >
          {{ loading ? '处理中…' : '我起来了' }}
        </button>
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

type Phase = 'alert' | 'standing'

const phase = ref<Phase>('alert')
const sitMinutes = ref(40)
const snoozeMinutes = ref(10)
const loading = ref(false)
const activitySeconds = ref(0)
const stretchIndex = ref(0)

const stretchEmojis = ['🧘', '💪', '🙆', '🚶', '🤸']

let unsubscribeMinutes: (() => void) | null = null
let unsubscribePhase: (() => void) | null = null
let activityTimer: ReturnType<typeof setInterval> | null = null
let activityStartAt = 0

const currentStretch = computed(() => STRETCH_TIPS[stretchIndex.value % STRETCH_TIPS.length])
const stretchEmoji = computed(() => stretchEmojis[stretchIndex.value % stretchEmojis.length])

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

onMounted(async () => {
  sitMinutes.value = await window.standUp.getReminderMinutes()
  const settings = await window.standUp.getSettings()
  snoozeMinutes.value = settings.snoozeMinutes

  unsubscribeMinutes = window.standUp.onReminderMinutes((minutes) => {
    sitMinutes.value = minutes
  })

  unsubscribePhase = window.standUp.onReminderPhase((p) => {
    switchPhase(p)
  })
})

onUnmounted(() => {
  unsubscribeMinutes?.()
  unsubscribePhase?.()
  stopActivityTimer()
})

async function handleConfirm(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    const ok = await window.standUp.confirmReminder()
    if (ok) {
      switchPhase('standing')
    }
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

.reminder__btn--primary {
  background: #ef4444;
  color: #fff;
  box-shadow: 0 12px 40px rgba(239, 68, 68, 0.35);
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
