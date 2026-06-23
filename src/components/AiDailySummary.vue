<template>
  <section class="ai-summary">
    <div class="ai-summary__header">
      <div class="ai-summary__title-wrap">
        <span class="ai-summary__icon">✨</span>
        <h3 class="ai-summary__title">AI 日终复盘</h3>
      </div>
      <n-button
        size="small"
        quaternary
        :loading="generating"
        :disabled="!enabled"
        @click="handleGenerate(true)"
      >
        {{ analysis?.status === 'ready' ? '重新生成' : '生成分析' }}
      </n-button>
    </div>

    <p v-if="!enabled" class="ai-summary__hint">
      请在设置中开启 AI 日终分析并配置 API Key
    </p>

    <div v-else-if="generating || analysis?.status === 'generating'" class="ai-summary__loading">
      <n-spin size="small" />
      <span>AI 正在分析今日数据…</span>
    </div>

    <div v-else-if="analysis?.status === 'error'" class="ai-summary__error">
      <p>{{ analysis.error || '分析失败，请稍后重试' }}</p>
      <n-button size="small" @click="handleGenerate(true)">重试</n-button>
    </div>

    <div v-else-if="analysis?.status === 'ready'" class="ai-summary__body">
      <p class="ai-summary__overview">{{ analysis.summary }}</p>

      <div v-if="analysis.highlights?.length" class="ai-summary__block">
        <h4>行为微观切片</h4>
        <ul>
          <li v-for="(item, index) in analysis.highlights" :key="`h-${index}`">{{ item }}</li>
        </ul>
      </div>

      <div v-if="analysis.suggestions?.length" class="ai-summary__block ai-summary__block--suggest">
        <h4>无痛微调</h4>
        <ul>
          <li v-for="(item, index) in analysis.suggestions" :key="`s-${index}`">{{ item }}</li>
        </ul>
      </div>

      <p v-if="analysis.tomorrowTip" class="ai-summary__tip">
        明日提示：{{ analysis.tomorrowTip }}
      </p>

      <p v-if="generatedLabel" class="ai-summary__meta">{{ generatedLabel }}</p>
    </div>

    <p v-else class="ai-summary__hint">
      点击「生成分析」，AI 将结合久坐时段、推迟提醒与应用切换，做一份懂工作流的断电复盘
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NSpin } from 'naive-ui'
import type { AiDailyAnalysis } from '@/types/session'

const props = defineProps<{
  date: string
  enabled: boolean
}>()

const analysis = ref<AiDailyAnalysis | null>(null)
const generating = ref(false)

const generatedLabel = computed(() => {
  if (!analysis.value?.generatedAt) {
    return ''
  }
  const time = new Date(analysis.value.generatedAt)
  const hh = String(time.getHours()).padStart(2, '0')
  const mm = String(time.getMinutes()).padStart(2, '0')
  return `生成于 ${hh}:${mm}`
})

async function loadAnalysis(): Promise<void> {
  analysis.value = await window.standUp.getAiAnalysis(props.date)
}

async function handleGenerate(force = false): Promise<void> {
  if (!props.enabled || generating.value) {
    return
  }
  generating.value = true
  try {
    analysis.value = await window.standUp.generateAiAnalysis(props.date, force)
  } finally {
    generating.value = false
  }
}

watch(
  () => props.date,
  () => {
    loadAnalysis()
  },
  { immediate: true }
)

defineExpose({
  refresh: loadAnalysis
})
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.ai-summary {
  padding: 16px;
  border-radius: var(--radius-md);
  @include glass-surface;
  box-shadow: var(--shadow-card);
  background: linear-gradient(135deg, rgba(238, 242, 255, 0.95), rgba(240, 253, 244, 0.9));
  border: 1px solid rgba(129, 140, 248, 0.25);
}

.ai-summary__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.ai-summary__title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-summary__icon {
  font-size: 16px;
}

.ai-summary__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

.ai-summary__hint {
  margin: 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
}

.ai-summary__loading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #475569;
}

.ai-summary__error {
  p {
    margin: 0 0 10px;
    font-size: 13px;
    color: #dc2626;
    line-height: 1.5;
  }
}

.ai-summary__overview {
  margin: 0 0 14px;
  font-size: 14px;
  color: #1e293b;
  line-height: 1.7;
}

.ai-summary__block {
  margin-bottom: 12px;

  h4 {
    margin: 0 0 6px;
    font-size: 13px;
    font-weight: 600;
    color: #334155;
  }

  ul {
    margin: 0;
    padding-left: 18px;
  }

  li {
    font-size: 13px;
    color: #475569;
    line-height: 1.6;

    & + li {
      margin-top: 4px;
    }
  }

  &--suggest li {
    color: #166534;
  }
}

.ai-summary__tip {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.65);
  font-size: 13px;
  color: #4338ca;
  line-height: 1.6;
}

.ai-summary__meta {
  margin: 10px 0 0;
  font-size: 11px;
  color: #94a3b8;
  text-align: right;
}
</style>
