<template>
  <div class="settings" :class="{ 'settings--embedded': embedded }">
    <h1 v-if="!embedded">设置</h1>

    <div class="settings__section-title">上下班时间</div>

    <div class="settings__field settings__field--row">
      <label>启用上下班提醒</label>
      <n-switch v-model:value="form.enableWorkSchedule" />
    </div>
    <p class="settings__hint settings__hint--block">
      到达上班时间且未手动开始计时时，提醒是否上班；到达下班时间且仍在计时时，提醒是否下班
    </p>

    <div class="settings__field settings__time-row">
      <label>上班时间</label>
      <div class="settings__time-inputs">
        <n-input-number v-model:value="workStartHour" :min="0" :max="23" :show-button="false" />
        <span class="settings__time-sep">:</span>
        <n-input-number v-model:value="workStartMinute" :min="0" :max="59" :show-button="false" />
      </div>
    </div>

    <div class="settings__field settings__time-row">
      <label>下班时间</label>
      <div class="settings__time-inputs">
        <n-input-number v-model:value="workEndHour" :min="0" :max="23" :show-button="false" />
        <span class="settings__time-sep">:</span>
        <n-input-number v-model:value="workEndMinute" :min="0" :max="59" :show-button="false" />
      </div>
    </div>

    <div class="settings__field">
      <label>上下班提醒等待时间（秒）</label>
      <n-input-number v-model:value="form.scheduleGraceSeconds" :min="15" :max="300" />
      <p class="settings__hint">无回应后自动开始上班或自动下班</p>
    </div>

    <div class="settings__field settings__field--row">
      <label>法定节假日休息</label>
      <n-switch v-model:value="form.enableHolidayRest" />
    </div>
    <p class="settings__hint settings__hint--block">
      开启后，法定节假日及周末不触发上下班提醒（含调休上班日判断，数据覆盖 2025–2026 年）
    </p>

    <div class="settings__section-title">提醒参数</div>

    <div class="settings__field">
      <label>久坐提醒间隔（分钟）</label>
      <n-input-number v-model:value="form.sitIntervalMinutes" :min="5" :max="120" />
    </div>

    <div class="settings__field">
      <label>站立目标时长（分钟）</label>
      <n-input-number v-model:value="form.standIntervalMinutes" :min="1" :max="30" />
      <p class="settings__hint">起立后的建议站立时间，结束后提醒坐下</p>
    </div>

    <div class="settings__field">
      <label>空闲检测阈值（分钟）</label>
      <n-input-number v-model:value="form.idleThresholdMinutes" :min="1" :max="60" />
      <p class="settings__hint">超过该时间无键鼠操作，自动暂停久坐计时</p>
    </div>

    <div class="settings__field">
      <label>自动起立判定（分钟）</label>
      <n-input-number v-model:value="form.autoStandIdleMinutes" :min="1" :max="10" />
      <p class="settings__hint">提醒弹出后，键鼠空闲超过该时间视为已起立；回来后自动坐下</p>
    </div>

    <div class="settings__field">
      <label>推迟提醒（分钟）</label>
      <n-input-number v-model:value="form.snoozeMinutes" :min="1" :max="30" />
    </div>

    <div class="settings__field">
      <label>全屏提醒延迟（秒）</label>
      <n-input-number v-model:value="form.toastGraceSeconds" :min="0" :max="180" />
      <p class="settings__hint">已弃用：倒计时归零后立即弹出全屏提醒，此设置不再生效</p>
    </div>

    <div class="settings__field">
      <label>每日起立目标（次）</label>
      <n-input-number v-model:value="form.dailyBreakGoal" :min="1" :max="30" />
      <p class="settings__hint">用于报告页达标率计算</p>
    </div>

    <div class="settings__field settings__field--row">
      <label>全屏应用自动免打扰</label>
      <n-switch v-model:value="form.autoDndFullscreen" />
    </div>
    <p class="settings__hint settings__hint--block">
      检测到前台全屏窗口时，自动暂停提醒 15 分钟（可能误判，默认关闭）
    </p>

    <div class="settings__field settings__field--row">
      <label>开机自启</label>
      <n-switch v-model:value="form.launchAtLogin" />
    </div>
    <p v-if="!isPackaged && form.launchAtLogin" class="settings__warn">
      开发模式下开机自启仅在打包安装后生效
    </p>

    <div class="settings__pause">
      <label>开会 / 暂停提醒</label>
      <div class="settings__pause-actions">
        <n-button size="small" @click="pauseOneHour">暂停 1 小时</n-button>
        <n-button size="small" @click="pauseUntilEnd">暂停到下班</n-button>
        <n-button v-if="isPaused" size="small" type="primary" @click="resumePause">恢复提醒</n-button>
      </div>
    </div>

    <n-button type="primary" block :loading="saving" @click="handleSave">
      保存设置
    </n-button>
    <p v-if="savedTip" class="settings__saved">{{ savedTip }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { NInputNumber, NSwitch, NButton } from 'naive-ui'
import type { AppSettings } from '@/types/session'

defineProps<{
  embedded?: boolean
}>()

const saving = ref(false)
const savedTip = ref('')
const isPackaged = ref(true)
const isPaused = ref(false)

const form = reactive<AppSettings>({
  sitIntervalMinutes: 40,
  standIntervalMinutes: 5,
  idleThresholdMinutes: 5,
  launchAtLogin: false,
  snoozeMinutes: 10,
  autoStandIdleMinutes: 2,
  dailyBreakGoal: 8,
  toastGraceSeconds: 60,
  autoDndFullscreen: false,
  workStartTime: '09:00',
  workEndTime: '18:00',
  enableWorkSchedule: true,
  enableHolidayRest: true,
  scheduleGraceSeconds: 60
})

function parseTimeParts(time: string): [number, number] {
  const [h, m] = time.split(':').map(Number)
  return [h || 0, m || 0]
}

function formatTimeParts(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const workStartHour = ref(9)
const workStartMinute = ref(0)
const workEndHour = ref(18)
const workEndMinute = ref(0)

watch([workStartHour, workStartMinute], () => {
  form.workStartTime = formatTimeParts(workStartHour.value, workStartMinute.value)
})

watch([workEndHour, workEndMinute], () => {
  form.workEndTime = formatTimeParts(workEndHour.value, workEndMinute.value)
})

function syncTimeFieldsFromForm(): void {
  const [sh, sm] = parseTimeParts(form.workStartTime)
  const [eh, em] = parseTimeParts(form.workEndTime)
  workStartHour.value = sh
  workStartMinute.value = sm
  workEndHour.value = eh
  workEndMinute.value = em
}

let unsubscribe: (() => void) | null = null

async function refreshPauseState(): Promise<void> {
  const status = await window.standUp.getSessionStatus()
  isPaused.value = status.isPaused
}

onMounted(async () => {
  const settings = await window.standUp.getSettings()
  Object.assign(form, settings)
  syncTimeFieldsFromForm()
  isPackaged.value = !window.location.href.includes('localhost')
  await refreshPauseState()
  unsubscribe = window.standUp.onStateChange(() => {
    refreshPauseState()
  })
})

onUnmounted(() => {
  unsubscribe?.()
})

async function pauseOneHour(): Promise<void> {
  await window.standUp.pauseReminder(60)
  savedTip.value = '已暂停提醒 1 小时'
}

async function pauseUntilEnd(): Promise<void> {
  await window.standUp.pauseUntilEndOfDay()
  savedTip.value = '已暂停到今日下班'
}

async function resumePause(): Promise<void> {
  await window.standUp.resumePause()
  savedTip.value = '提醒已恢复'
}

async function handleSave(): Promise<void> {
  saving.value = true
  savedTip.value = ''
  try {
    await window.standUp.saveSettings({ ...form })
    savedTip.value = '设置已保存，久坐间隔变更将立即生效'
  } catch {
    savedTip.value = '保存失败'
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.settings {
  box-sizing: border-box;

  &--embedded {
    padding: 0;
    min-height: auto;
    background: transparent;
  }

  &:not(&--embedded) {
    padding: 24px 28px 32px;
    min-height: 100vh;
    background: #fff;
  }

  h1 {
    margin: 0 0 24px;
    font-size: 22px;
    color: #0f172a;
  }
}

.settings__section-title {
  margin: 8px 0 16px;
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;

  &:not(:first-child) {
    margin-top: 28px;
  }
}

.settings__time-row {
  .settings__time-inputs {
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: 160px;
  }
}

.settings__time-sep {
  font-size: 16px;
  color: #64748b;
  line-height: 1;
}

.settings__field {
  margin-bottom: 20px;

  label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    color: #334155;
    font-weight: 500;
  }

  &--row {
    display: flex;
    align-items: center;
    justify-content: space-between;

    label {
      margin-bottom: 0;
    }
  }
}

.settings__hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #94a3b8;

  &--block {
    margin: -12px 0 16px;
  }
}

.settings__pause {
  margin-bottom: 24px;
  padding: 14px;
  border-radius: var(--radius-md);
  @include glass-surface;
  box-shadow: var(--shadow-card);

  label {
    display: block;
    margin-bottom: 10px;
    font-size: 14px;
    font-weight: 500;
    color: #334155;
  }
}

.settings__pause-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.settings__warn {
  margin: -12px 0 16px;
  font-size: 12px;
  color: #f59e0b;
}

.settings__saved {
  margin: 12px 0 0;
  text-align: center;
  font-size: 13px;
  color: #16a34a;
}
</style>
