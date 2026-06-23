<template>
  <div class="level-progress">
    <div class="level-progress__header">
      <span class="level-progress__badge">Lv.{{ level }}</span>
      <span class="level-progress__title">{{ title }}</span>
      <span class="level-progress__streak">连续 {{ streakDays }} 天</span>
    </div>
    <div class="level-progress__bar">
      <div class="level-progress__fill" :style="{ width: `${percent}%` }" />
    </div>
    <p class="level-progress__hint">
      再起立 {{ pointsToNext }} 次升级 · 累计 {{ totalBreaks }} 次
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GamificationState } from '@/types/session'
import { getLevelProgress, getLevelTitle } from '@/utils/gamification'

const props = defineProps<{
  gamification: GamificationState
}>()

const level = computed(() => props.gamification.level)
const streakDays = computed(() => props.gamification.streakDays)
const totalBreaks = computed(() => props.gamification.totalBreaks)
const title = computed(() => getLevelTitle(props.gamification.level))
const progressData = computed(() => getLevelProgress(props.gamification))
const percent = computed(() => progressData.value.percent)
const pointsToNext = computed(() => progressData.value.pointsToNext)
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.level-progress {
  padding: 16px 18px;
  border-radius: var(--radius-md);
  @include elevated-surface;
  background: linear-gradient(135deg, rgba(240, 253, 244, 0.95), rgba(255, 255, 255, 0.88));
  border-color: rgba(187, 247, 208, 0.5);
}

.level-progress__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.level-progress__badge {
  @include display-num;
  font-size: 13px;
  font-weight: 800;
  color: #15803d;
  background: rgba(34, 197, 94, 0.15);
  padding: 3px 10px;
  border-radius: var(--radius-pill);
}

.level-progress__title {
  font-size: 14px;
  font-weight: 600;
  color: #166534;
}

.level-progress__streak {
  margin-left: auto;
  font-size: 12px;
  color: #64748b;
}

.level-progress__bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.15);
  overflow: hidden;
}

.level-progress__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #4ade80, #22c55e);
  transition: width 0.6s var(--ease-out);
}

.level-progress__hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #64748b;
}
</style>
