<template>
  <div class="stat-card" :class="{ 'stat-card--highlight': highlight }">
    <p class="stat-card__label">{{ label }}</p>
    <p class="stat-card__value" :class="{ 'stat-card__value--highlight': highlight }">{{ value }}</p>
    <div v-if="$slots.footer" class="stat-card__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string
  highlight?: boolean
}>()
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.stat-card {
  padding: 16px 18px;
  border-radius: var(--radius-md);
  @include glass-surface;
  box-shadow: var(--shadow-card);
  transition:
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-card-hover);
  }
}

.stat-card__label {
  margin: 0 0 8px;
  font-size: 13px;
  color: #64748b;
}

.stat-card__value {
  margin: 0;
  @include display-num;
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;

  &--highlight {
    font-size: 28px;
    color: var(--color-state-sitting);
  }
}

.stat-card__footer {
  margin-top: 12px;
}
</style>
