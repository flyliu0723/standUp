<template>
  <div v-if="visible" class="stand-reason-picker">
    <div class="stand-reason-picker__backdrop" @click="emit('close')" />
    <div class="stand-reason-picker__panel">
      <header class="stand-reason-picker__head">
        <h3 class="stand-reason-picker__title">选择离开原因</h3>
        <button type="button" class="stand-reason-picker__close" @click="emit('close')">×</button>
      </header>
      <p class="stand-reason-picker__hint">不同原因对应不同的计时方式</p>
      <ul class="stand-reason-picker__list">
        <li v-for="option in options" :key="option.id">
          <button
            type="button"
            class="stand-reason-picker__item"
            :class="{ 'stand-reason-picker__item--paused': option.mode === 'paused' }"
            @click="handleSelect(option.id)"
          >
            <span class="stand-reason-picker__emoji">{{ option.emoji }}</span>
            <span class="stand-reason-picker__meta">
              <span class="stand-reason-picker__label">{{ option.label }}</span>
              <span class="stand-reason-picker__sub">{{ option.hint }}</span>
            </span>
            <span class="stand-reason-picker__duration">{{ formatReasonDuration(option.durationMinutes) }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { STAND_REASON_OPTIONS, formatReasonDuration } from '@/utils/standReasons'
import type { StandReasonId } from '@/types/session'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  select: [reasonId: StandReasonId]
}>()

const options = STAND_REASON_OPTIONS

function handleSelect(id: StandReasonId): void {
  emit('select', id)
}
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.stand-reason-picker {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.stand-reason-picker__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
}

.stand-reason-picker__panel {
  position: relative;
  width: 100%;
  max-width: 360px;
  @include glass-surface;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: 16px 16px 12px;
}

.stand-reason-picker__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.stand-reason-picker__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.stand-reason-picker__close {
  border: none;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  color: #94a3b8;
  cursor: pointer;
  padding: 0 4px;
}

.stand-reason-picker__hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: #64748b;
}

.stand-reason-picker__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stand-reason-picker__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: border-color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);

  &:hover {
    border-color: #86efac;
    background: #f0fdf4;
  }

  &--paused:hover {
    border-color: #fcd34d;
    background: #fffbeb;
  }
}

.stand-reason-picker__emoji {
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
}

.stand-reason-picker__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stand-reason-picker__label {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.stand-reason-picker__sub {
  font-size: 11px;
  color: #94a3b8;
}

.stand-reason-picker__duration {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  @include display-num;
}
</style>
