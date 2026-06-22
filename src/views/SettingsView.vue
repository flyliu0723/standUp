<template>
  <div class="settings" :class="{ 'settings--embedded': embedded }">
    <h1 v-if="!embedded">设置</h1>

    <SettingsCollapsible title="作息与上下班" subtitle="上下班提醒、节假日">
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
    </SettingsCollapsible>

    <SettingsCollapsible title="桌面与显示" subtitle="状态条、桌面宠物" :open="false">
      <div class="settings__field">
        <label>常驻显示模式</label>
        <n-radio-group v-model:value="form.ambientDisplayMode" class="settings__radio-group">
          <n-radio value="none">不显示</n-radio>
          <n-radio value="statusBar">顶部状态条</n-radio>
          <n-radio value="desktopPet">桌面宠物</n-radio>
        </n-radio-group>
        <p class="settings__hint">状态条：屏幕边缘健康 HUD；宠物：右下角小盆栽，点击打开主界面</p>
      </div>

      <div v-if="form.ambientDisplayMode === 'statusBar'" class="settings__field">
        <label>状态条位置</label>
        <n-select
          v-model:value="statusBarPlacementId"
          :options="statusBarPlacementOptions"
          placeholder="选择显示器与边缘"
        />
        <p class="settings__hint">
          双显示器时自动隐藏相邻内边（拼接处）；左右侧为竖向布局
        </p>
      </div>
    </SettingsCollapsible>

    <SettingsCollapsible title="健康监测" subtitle="活动监测、微动作" :open="false">
      <div class="settings__field settings__field--row">
        <label>启用活动监测</label>
        <n-switch v-model:value="form.enableActivityMonitor" />
      </div>
      <p class="settings__hint settings__hint--block">
        监测键盘/鼠标频率、鼠标活动范围、前台应用，用于静止工作指数和颈椎风险评估
      </p>

      <div class="settings__field settings__field--row">
        <label>微动作提醒</label>
        <n-switch v-model:value="form.enableMicroActionReminders" />
      </div>
      <p class="settings__hint settings__hint--block">
        连续活跃时弹出轻量提示（转头、耸肩等），只需 3 秒
      </p>

      <div class="settings__field">
        <label>微动作提醒间隔（分钟）</label>
        <n-input-number v-model:value="form.microActionIntervalMinutes" :min="5" :max="60" />
      </div>

      <div class="settings__field settings__field--row">
        <label>娱乐应用软提醒</label>
        <n-switch v-model:value="form.enableEntertainmentSoftReminder" />
      </div>
      <p class="settings__hint settings__hint--block">
        检测到 Steam、B站等娱乐应用时，偶尔提醒活动脖子和肩膀
      </p>
    </SettingsCollapsible>

    <SettingsCollapsible title="应用类型" subtitle="工作 / 娱乐 / 社交分类">
      <AppCategorySettings v-model:overrides="form.appCategoryOverrides" />
    </SettingsCollapsible>

    <SettingsCollapsible title="提醒与计时" subtitle="久坐、站立、空闲" :open="false">
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
        <label>无输入暂停计时（分钟）</label>
        <n-input-number v-model:value="form.inactivePauseMinutes" :min="1" :max="30" />
        <p class="settings__hint">无键鼠输入超过该时间，暂停久坐倒计时（仍计入坐时）；超过空闲检测阈值则进入离座状态</p>
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
        <label>角落卡片显示（秒）</label>
        <n-input-number v-model:value="form.toastGraceSeconds" :min="3" :max="120" />
        <p class="settings__hint">久坐到时全屏提醒会立即出现；右下角卡片为轻提示，显示该时长后自动关闭</p>
      </div>

      <div class="settings__field">
        <label>每日起立目标（次）</label>
        <n-input-number v-model:value="form.dailyBreakGoal" :min="1" :max="30" />
        <p class="settings__hint">用于报告页达标率计算</p>
      </div>
    </SettingsCollapsible>

    <SettingsCollapsible title="智能延后" subtitle="编码中、全屏免打扰" :open="false">
      <div class="settings__field settings__field--row">
        <label>编码中智能延后</label>
        <n-switch v-model:value="form.enableIdeGuard" />
      </div>
      <p class="settings__hint settings__hint--block">
        检测到 Cursor / VS Code 等 IDE 前台且正在输入时，先询问是否延后提醒
      </p>

      <div class="settings__field">
        <label>编码活跃判定（秒）</label>
        <n-input-number v-model:value="form.ideActiveThresholdSeconds" :min="30" :max="600" />
        <p class="settings__hint">最近多少秒内有键鼠输入，视为「正在编码」</p>
      </div>

      <div class="settings__field settings__field--row">
        <label>全屏应用自动免打扰</label>
        <n-switch v-model:value="form.autoDndFullscreen" />
      </div>
      <p class="settings__hint settings__hint--block">
        检测到前台全屏窗口时，自动暂停提醒 15 分钟（可能误判，默认关闭）
      </p>
    </SettingsCollapsible>

    <SettingsCollapsible title="系统" subtitle="开机自启" :open="false">
      <div class="settings__field settings__field--row">
        <label>开机自启</label>
        <n-switch v-model:value="form.launchAtLogin" />
      </div>
      <p v-if="!isPackaged && form.launchAtLogin" class="settings__warn">
        开发模式下开机自启仅在打包安装后生效
      </p>
    </SettingsCollapsible>

    <SettingsCollapsible title="AI 日终分析" subtitle="报告复盘" :open="false">
      <div class="settings__field settings__field--row">
        <label>启用 AI 日终分析</label>
        <n-switch v-model:value="form.enableAiDailyAnalysis" />
      </div>
      <p class="settings__hint settings__hint--block">
        在报告页或下班时，将今日健康数据交给 AI 分析并给出建议（需自行配置 API Key，数据仅发往您选择的模型服务商）
      </p>

      <template v-if="form.enableAiDailyAnalysis">
        <div class="settings__field">
          <label>AI 服务商</label>
          <n-radio-group v-model:value="form.aiProvider" class="settings__radio-group">
            <n-radio value="deepseek">DeepSeek</n-radio>
            <n-radio value="openai">OpenAI</n-radio>
            <n-radio value="custom">自定义（OpenAI 兼容）</n-radio>
          </n-radio-group>
        </div>

        <div class="settings__field">
          <label>API Key</label>
          <n-input
            v-model:value="form.aiApiKey"
            type="password"
            show-password-on="click"
            placeholder="请输入 API Key"
          />
        </div>

        <div v-if="form.aiProvider === 'custom'" class="settings__field">
          <label>接口地址</label>
          <n-input
            v-model:value="form.aiBaseUrl"
            placeholder="https://your-api.com/v1/chat/completions"
          />
        </div>

        <div class="settings__field">
          <label>模型名称</label>
          <n-input v-model:value="form.aiModel" :placeholder="modelPlaceholder" />
          <p class="settings__hint">留空则使用默认模型（DeepSeek: deepseek-chat，OpenAI: gpt-4o-mini）</p>
        </div>

        <div class="settings__field settings__field--row">
          <label>下班时自动生成</label>
          <n-switch v-model:value="form.aiTriggerOnWorkEnd" />
        </div>
        <p class="settings__hint settings__hint--block">
          点击「下班」或到达下班时间自动结束时，后台生成 AI 复盘并推送通知
        </p>

        <div class="settings__field settings__field--row">
          <label>包含具体应用名称</label>
          <n-switch v-model:value="form.aiIncludeAppNames" />
        </div>
        <p class="settings__hint settings__hint--block">
          关闭时仅发送工作/娱乐等分类占比，不发送 Cursor、Chrome 等具体应用名（推荐）
        </p>
      </template>
    </SettingsCollapsible>

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
import { computed, onMounted, onUnmounted, reactive, ref, toRaw, watch } from 'vue'
import { NInput, NInputNumber, NSwitch, NButton, NRadioGroup, NRadio, NSelect, useMessage } from 'naive-ui'
import SettingsCollapsible from '@/components/SettingsCollapsible.vue'
import AppCategorySettings from '@/components/AppCategorySettings.vue'
import type { AmbientDisplayMode, AppSettings, StatusBarEdge } from '@/types/session'

defineProps<{
  embedded?: boolean
}>()

const message = useMessage()
const saving = ref(false)
const savedTip = ref('')
const isPackaged = ref(true)
const isPaused = ref(false)
const statusBarPlacementOptions = ref<{ label: string; value: string }[]>([])

const statusBarPlacementId = computed({
  get(): string {
    return `${form.statusBarDisplayId}:${form.statusBarEdge}`
  },
  set(id: string) {
    const splitAt = id.indexOf(':')
    if (splitAt <= 0) {
      return
    }
    form.statusBarDisplayId = Number(id.slice(0, splitAt))
    form.statusBarEdge = id.slice(splitAt + 1) as StatusBarEdge
  }
})

async function loadStatusBarPlacements(): Promise<void> {
  const list = await window.standUp.getStatusBarPlacements()
  statusBarPlacementOptions.value = list.map((item) => ({
    label: item.label,
    value: item.id
  }))
  const currentId = statusBarPlacementId.value
  if (!list.some((item) => item.id === currentId) && list[0]) {
    statusBarPlacementId.value = list[0].id
  }
}

const form = reactive<AppSettings>({
  sitIntervalMinutes: 40,
  standIntervalMinutes: 5,
  idleThresholdMinutes: 5,
  launchAtLogin: false,
  snoozeMinutes: 10,
  autoStandIdleMinutes: 2,
  dailyBreakGoal: 8,
  toastGraceSeconds: 8,
  overlayGraceSeconds: 30,
  enableIdeGuard: true,
  ideActiveThresholdSeconds: 120,
  inactivePauseMinutes: 3,
  ambientDisplayMode: 'none' as AmbientDisplayMode,
  statusBarDisplayId: 0,
  statusBarEdge: 'top' as StatusBarEdge,
  autoDndFullscreen: false,
  workStartTime: '09:00',
  workEndTime: '18:00',
  enableWorkSchedule: true,
  enableHolidayRest: true,
  scheduleGraceSeconds: 60,
  enableActivityMonitor: true,
  enableMicroActionReminders: true,
  microActionIntervalMinutes: 15,
  enableEntertainmentSoftReminder: true,
  enableAiDailyAnalysis: false,
  aiProvider: 'deepseek',
  aiApiKey: '',
  aiBaseUrl: '',
  aiModel: '',
  aiTriggerOnWorkEnd: true,
  aiIncludeAppNames: false,
  appCategoryOverrides: {}
})

const modelPlaceholder = computed(() => {
  if (form.aiProvider === 'openai') return 'gpt-4o-mini'
  if (form.aiProvider === 'deepseek') return 'deepseek-chat'
  return 'your-model-name'
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
  form.appCategoryOverrides = { ...(settings.appCategoryOverrides ?? {}) }
  await loadStatusBarPlacements()
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

function buildSettingsPayload(): AppSettings {
  const raw = toRaw(form)
  return {
    ...raw,
    appCategoryOverrides: { ...raw.appCategoryOverrides }
  }
}

async function handleSave(): Promise<void> {
  saving.value = true
  savedTip.value = ''
  try {
    const saved = await window.standUp.saveSettings(buildSettingsPayload())
    form.appCategoryOverrides = { ...(saved.appCategoryOverrides ?? {}) }
    savedTip.value = '设置已保存，久坐间隔与应用分类变更将立即生效'
    message.success('设置已保存')
  } catch (error) {
    console.error('[settings] save failed', error)
    savedTip.value = '保存失败，请重试'
    message.error('保存失败，请重试')
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
    margin: 0 0 20px;
    font-size: 22px;
    color: #0f172a;
  }
}

.settings__radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
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
  margin: 8px 0 20px;
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
