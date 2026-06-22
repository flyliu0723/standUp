<template>
  <section class="execution-stats">
    <h3>今日执行力</h3>
    <div class="execution-stats__grid">
      <div class="execution-stats__item execution-stats__item--on-time">
        <span class="execution-stats__value">{{ execution.onTimeCount }}</span>
        <span class="execution-stats__label">按时起立</span>
      </div>
      <div class="execution-stats__item execution-stats__item--delayed">
        <span class="execution-stats__value">{{ execution.delayedCount }}</span>
        <span class="execution-stats__label">延迟起立</span>
      </div>
      <div class="execution-stats__item execution-stats__item--ignored">
        <span class="execution-stats__value">{{ execution.ignoredCount }}</span>
        <span class="execution-stats__label">忽略提醒</span>
      </div>
    </div>
    <p v-if="execution.triggeredCount > 0" class="execution-stats__hint">
      提醒 {{ execution.triggeredCount }} 次 · 按时率 {{ execution.onTimeRate }}%
    </p>
    <p v-else class="execution-stats__hint execution-stats__hint--empty">
      今日暂无提醒记录，继续保持
    </p>
  </section>
</template>

<script setup lang="ts">
import type { ExecutionStats } from '@/types/session'

defineProps<{
  execution: ExecutionStats
}>()
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.execution-stats {
  h3 {
    margin: 0 0 10px;
    font-size: 14px;
    color: #64748b;
    font-weight: 600;
  }
}

.execution-stats__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.execution-stats__item {
  padding: 14px 12px;
  border-radius: var(--radius-md);
  @include glass-surface;
  box-shadow: var(--shadow-card);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.execution-stats__value {
  @include display-num;
  font-size: 22px;
  font-weight: 800;
  line-height: 1.1;
}

.execution-stats__label {
  font-size: 11px;
  color: #64748b;
}

.execution-stats__item--on-time .execution-stats__value {
  color: #16a34a;
}

.execution-stats__item--delayed .execution-stats__value {
  color: #f59e0b;
}

.execution-stats__item--ignored .execution-stats__value {
  color: #ef4444;
}

.execution-stats__hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #94a3b8;
  text-align: center;

  &--empty {
    color: #cbd5e1;
  }
}
</style>
