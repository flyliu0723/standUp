<template>
  <header class="titlebar">
    <div class="titlebar__drag">
      <span class="titlebar__title">{{ title }}</span>
    </div>
    <div class="titlebar__controls">
      <button
        type="button"
        class="titlebar__btn"
        aria-label="最小化"
        @click="handleMinimize"
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
          <rect width="10" height="1" />
        </svg>
      </button>
      <button
        type="button"
        class="titlebar__btn titlebar__btn--close"
        aria-label="关闭"
        @click="handleClose"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M1 1l8 8M9 1L1 9" />
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
  }>(),
  {
    title: 'standUp'
  }
)

function handleMinimize(): void {
  window.standUp.windowMinimize()
}

function handleClose(): void {
  window.standUp.windowClose()
}
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.titlebar {
  display: flex;
  align-items: stretch;
  height: var(--titlebar-height);
  flex-shrink: 0;
  user-select: none;
  border-bottom: 1px solid var(--color-border-subtle);
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.titlebar__drag {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 16px;
  -webkit-app-region: drag;
  app-region: drag;
}

.titlebar__title {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  letter-spacing: 0.02em;
}

.titlebar__controls {
  display: flex;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.titlebar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(15, 23, 42, 0.06);
    color: #334155;
  }

  &--close:hover {
    background: #e81123;
    color: #fff;
  }
}
</style>
