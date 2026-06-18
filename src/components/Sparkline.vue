<template>
  <svg class="sparkline" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
    <polyline
      v-if="points"
      :points="points"
      fill="none"
      stroke="rgba(34, 197, 94, 0.75)"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  values: number[]
}>()

const points = computed(() => {
  const vals = props.values
  if (!vals.length) return ''

  const max = Math.max(...vals, 1)
  const step = vals.length > 1 ? 100 / (vals.length - 1) : 0

  return vals
    .map((v, i) => {
      const x = vals.length > 1 ? i * step : 50
      const y = 22 - (v / max) * 18
      return `${x},${y}`
    })
    .join(' ')
})
</script>

<style lang="scss" scoped>
.sparkline {
  display: block;
  width: 100%;
  height: 24px;
}
</style>
