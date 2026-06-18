<template>
  <div class="mini-day-bar">
    <div class="mini-day-bar__track">
      <div
        v-for="(block, i) in blocks"
        :key="i"
        class="mini-day-bar__block"
        :class="`mini-day-bar__block--${block.type}`"
        :style="blockStyle(block)"
        :title="block.title"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WorkSession } from '@/types/session'
import { buildTimelineBlocks, timelineBlockStyle } from '@/utils/timelineBlocks'
import { toDateString } from '@/utils/format'

const props = defineProps<{
  sessions: WorkSession[]
  date?: string
}>()

const blocks = computed(() =>
  buildTimelineBlocks(props.sessions, props.date ?? toDateString(Date.now()))
)

function blockStyle(block: ReturnType<typeof buildTimelineBlocks>[number]) {
  return timelineBlockStyle(block, 0.5)
}
</script>

<style lang="scss" scoped>
.mini-day-bar__track {
  position: relative;
  height: 6px;
  background: rgba(226, 232, 240, 0.8);
  border-radius: 3px;
  overflow: hidden;
}

.mini-day-bar__block {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 2px;

  &--sit {
    background: linear-gradient(180deg, #f87171, #ef4444);
  }

  &--break {
    background: linear-gradient(180deg, #86efac, #4ade80);
  }

  &--away {
    background: linear-gradient(180deg, #cbd5e1, #94a3b8);
  }
}
</style>
