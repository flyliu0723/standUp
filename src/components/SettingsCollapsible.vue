<template>
  <details class="settings-collapse" :open="open">
    <summary class="settings-collapse__summary">
      <span class="settings-collapse__title">{{ title }}</span>
      <span v-if="subtitle" class="settings-collapse__subtitle">{{ subtitle }}</span>
    </summary>
    <div class="settings-collapse__body">
      <slot />
    </div>
  </details>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    open?: boolean
  }>(),
  {
    open: true
  }
)
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.settings-collapse {
  @include elevated-surface;
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-sm);
  overflow: hidden;

  &__summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px;
    cursor: pointer;
    list-style: none;
    user-select: none;
    transition: background var(--duration-fast) var(--ease-out);

    &:hover {
      background: rgba(241, 245, 249, 0.5);
    }

    &::-webkit-details-marker {
      display: none;
    }
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: #0f172a;
  }

  &__subtitle {
    font-size: 12px;
    color: #94a3b8;
    flex-shrink: 0;
  }

  &__body {
    padding: 4px 18px 18px;
  }
}
</style>
