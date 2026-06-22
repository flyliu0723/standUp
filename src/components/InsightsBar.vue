<template>
  <div v-if="insights.length" class="insights-bar" :class="`insights-bar--${current.kind}`">
    <div class="insights-bar__header">
      <span class="insights-bar__icon">{{ kindIcon }}</span>
      <span class="insights-bar__label">{{ kindLabel }}</span>
      <div v-if="insights.length > 1" class="insights-bar__dots">
        <button
          v-for="(item, index) in insights"
          :key="item.id"
          type="button"
          class="insights-bar__dot"
          :class="{ 'insights-bar__dot--active': index === activeIndex }"
          :aria-label="`洞察 ${index + 1}`"
          @click="goTo(index)"
        />
      </div>
    </div>
    <p class="insights-bar__message">{{ current.message }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ActionableInsight, InsightKind } from '@/types/session'

const props = withDefaults(
  defineProps<{
    insights: ActionableInsight[]
    intervalMs?: number
  }>(),
  {
    intervalMs: 6000
  }
)

const activeIndex = ref(0)
let rotateTimer: ReturnType<typeof setInterval> | null = null

const current = computed(() => props.insights[activeIndex.value] || props.insights[0])

const KIND_META: Record<InsightKind, { icon: string; label: string }> = {
  peak_sitting: { icon: '⏰', label: '久坐高峰' },
  procrastination: { icon: '🎯', label: '执行力' },
  goal: { icon: '🏆', label: '达标节奏' },
  health: { icon: '💚', label: '健康收益' },
  focus: { icon: '🧠', label: '专注时段' },
  encourage: { icon: '💡', label: '健康教练' }
}

const kindIcon = computed(() => KIND_META[current.value.kind]?.icon || '💡')
const kindLabel = computed(() => KIND_META[current.value.kind]?.label || '健康教练')

function goTo(index: number): void {
  activeIndex.value = index
  restartRotate()
}

function next(): void {
  if (props.insights.length <= 1) return
  activeIndex.value = (activeIndex.value + 1) % props.insights.length
}

function restartRotate(): void {
  if (rotateTimer) clearInterval(rotateTimer)
  if (props.insights.length <= 1) return
  rotateTimer = setInterval(next, props.intervalMs)
}

watch(
  () => props.insights,
  () => {
    activeIndex.value = 0
    restartRotate()
  },
  { deep: true }
)

onMounted(() => {
  restartRotate()
})

onUnmounted(() => {
  if (rotateTimer) clearInterval(rotateTimer)
})
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.insights-bar {
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  @include glass-surface;
  box-shadow: var(--shadow-card);
  line-height: 1.6;
  flex-shrink: 0;

  &--procrastination {
    background: rgba(255, 251, 235, 0.9);
    border: 1px solid #fde68a;
  }

  &--health {
    background: rgba(240, 253, 244, 0.9);
    border: 1px solid #bbf7d0;
  }

  &--focus {
    background: rgba(245, 243, 255, 0.9);
    border: 1px solid #ddd6fe;
  }

  &--goal,
  &--encourage,
  &--peak_sitting {
    background: rgba(239, 246, 255, 0.9);
    border: 1px solid #bfdbfe;
  }
}

.insights-bar__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.insights-bar__icon {
  font-size: 14px;
}

.insights-bar__label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.insights-bar__dots {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.insights-bar__dot {
  width: 6px;
  height: 6px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #cbd5e1;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;

  &--active {
    background: #22c55e;
    transform: scale(1.2);
  }
}

.insights-bar__message {
  margin: 0;
  font-size: 13px;
  color: #1e293b;
}
</style>
