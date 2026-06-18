<template>
  <div class="cyber-plant" :class="plantClasses">
    <div class="cyber-plant__pot" />
    <div class="cyber-plant__stem" />
    <div class="cyber-plant__leaves">
      <span v-for="i in leafCount" :key="i" class="cyber-plant__leaf" />
    </div>
    <div class="cyber-plant__info">
      <strong>Lv.{{ level }}</strong>
      <span>连续达标 {{ streakDays }} 天</span>
      <span>累计起立 {{ totalBreaks }} 次</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WorkState } from '@/types/session'

const props = defineProps<{
  level: number
  streakDays: number
  totalBreaks: number
  workState?: WorkState
  currentSitMs?: number
}>()

const stage = computed(() => Math.min(5, Math.max(1, props.level)))

const leafCount = computed(() => Math.min(6, 1 + Math.floor(props.level / 2)))

const plantClasses = computed(() => {
  const classes = [`cyber-plant--stage-${stage.value}`]
  const state = props.workState ?? 'offDuty'

  classes.push(`cyber-plant--${state}`)

  if (state === 'sitting' && (props.currentSitMs ?? 0) > 30 * 60_000) {
    classes.push('cyber-plant--tired')
  }

  return classes
})
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.cyber-plant {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  background: linear-gradient(180deg, #ecfdf5, #f0fdf4);
  border: 1px solid #bbf7d0;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    filter var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);
}

.cyber-plant--offDuty {
  filter: grayscale(0.85);
  opacity: 0.75;

  .cyber-plant__leaf {
    animation: none;
  }
}

.cyber-plant--standing {
  background: linear-gradient(180deg, #dcfce7, #f0fdf4);
  border-color: #86efac;

  .cyber-plant__leaf {
    animation: leaf-sway-active 1.6s ease-in-out infinite alternate;
  }
}

.cyber-plant--sitting.cyber-plant--tired {
  opacity: 0.85;

  .cyber-plant__leaf {
    background: #a3e635;
    animation-duration: 3s;
  }

  .cyber-plant__stem {
    background: #65a30d;
  }
}

.cyber-plant__pot {
  width: 48px;
  height: 20px;
  background: linear-gradient(180deg, #a78bfa, #7c3aed);
  border-radius: 4px 4px 8px 8px;
  margin-top: 8px;
}

.cyber-plant__stem {
  width: 4px;
  background: #16a34a;
  border-radius: 2px;
  transition: background var(--duration-fast) var(--ease-out);
}

.cyber-plant--stage-1 .cyber-plant__stem { height: 12px; }
.cyber-plant--stage-2 .cyber-plant__stem { height: 24px; }
.cyber-plant--stage-3 .cyber-plant__stem { height: 36px; }
.cyber-plant--stage-4 .cyber-plant__stem { height: 48px; }
.cyber-plant--stage-5 .cyber-plant__stem { height: 56px; }

.cyber-plant__leaves {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.cyber-plant__leaf {
  width: 14px;
  height: 14px;
  background: #4ade80;
  border-radius: 50% 0 50% 0;
  animation: leaf-sway 2s ease-in-out infinite alternate;
  transition: background var(--duration-fast) var(--ease-out);
}

.cyber-plant__leaf:nth-child(2) { animation-delay: 0.3s; }
.cyber-plant__leaf:nth-child(3) { animation-delay: 0.6s; }

.cyber-plant__info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #166534;

  strong {
    font-size: 16px;
    color: #15803d;
  }
}

@keyframes leaf-sway {
  from { transform: rotate(-8deg); }
  to { transform: rotate(8deg); }
}

@keyframes leaf-sway-active {
  from { transform: rotate(-12deg) scale(1); }
  to { transform: rotate(12deg) scale(1.05); }
}
</style>
