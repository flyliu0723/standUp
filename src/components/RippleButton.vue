<template>
  <button
    type="button"
    class="ripple-btn"
    :class="{ 'ripple-btn--disabled': disabled }"
    :disabled="disabled"
    @click="handleClick"
  >
    <span
      v-for="ripple in ripples"
      :key="ripple.id"
      class="ripple-btn__wave"
      :style="ripple.style"
    />
    <span class="ripple-btn__content">
      <slot />
    </span>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  disabled?: boolean
  ripple?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

interface RippleItem {
  id: number
  style: Record<string, string>
}

const ripples = ref<RippleItem[]>([])
let rippleId = 0

function handleClick(event: MouseEvent): void {
  if (props.disabled) return

  if (props.ripple !== false) {
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const x = event.clientX - rect.left - size / 2
    const y = event.clientY - rect.top - size / 2
    const id = ++rippleId

    ripples.value.push({
      id,
      style: {
        width: `${size}px`,
        height: `${size}px`,
        left: `${x}px`,
        top: `${y}px`
      }
    })

    window.setTimeout(() => {
      ripples.value = ripples.value.filter((r) => r.id !== id)
    }, 400)
  }

  emit('click')
}
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.ripple-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: none;
  cursor: pointer;
  font: inherit;
  border-radius: var(--radius-md);
  transition: opacity var(--duration-fast) var(--ease-out);

  &--disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.ripple-btn__content {
  position: relative;
  z-index: 1;
  display: inherit;
  align-items: inherit;
  justify-content: inherit;
  gap: inherit;
  width: 100%;
}

.ripple-btn__wave {
  position: absolute;
  border-radius: 50%;
  background: rgba(34, 197, 94, 0.25);
  transform: scale(0);
  animation: ripple-expand 400ms var(--ease-out) forwards;
  pointer-events: none;
}

@keyframes ripple-expand {
  to {
    transform: scale(2.5);
    opacity: 0;
  }
}
</style>
