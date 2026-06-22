<template>
  <div class="timeline">
    <div class="timeline__toolbar">
      <span class="timeline__zoom-hint">滚轮缩放</span>
      <span v-if="zoom > 1" class="timeline__zoom-level">{{ zoomLabel }}</span>
      <button
        v-if="zoom > 1"
        type="button"
        class="timeline__zoom-reset"
        @click="resetZoom"
      >
        重置
      </button>
    </div>

    <div
      ref="viewportRef"
      class="timeline__viewport"
      :class="{ 'timeline__viewport--draggable': zoom > 1 }"
      @wheel.prevent="onWheel"
      @mousedown="onMouseDown"
    >
      <div class="timeline__content" :style="contentStyle">
        <div class="timeline__hours">
          <span
            v-for="h in hourMarks"
            :key="h"
            class="timeline__hour"
            :style="hourStyle(h)"
          >
            {{ h }}
          </span>
        </div>
        <div class="timeline__track">
          <div
            v-for="(block, i) in blocks"
            :key="i"
            class="timeline__block"
            :class="`timeline__block--${block.type}`"
            :style="blockStyle(block)"
            :title="block.title"
          />
          <p v-if="blocks.length === 0" class="timeline__empty">暂无久坐记录</p>
        </div>
      </div>
    </div>

    <div class="timeline__legend">
      <span><i class="dot dot--sit" />久坐</span>
      <span
        v-for="item in legendReasons"
        :key="item.key"
      >
        <i class="dot" :style="{ background: item.color }" />{{ item.label }}
      </span>
      <span><i class="dot dot--away" />离座</span>
      <span v-if="zoom > 1" class="timeline__legend-hint">按住拖动平移</span>
    </div>

    <div v-if="hourlyRows.length && zoom <= 1" class="timeline__hourly">
      <h4>按小时分布</h4>
      <div class="timeline__hourly-list">
        <div v-for="row in hourlyRows" :key="row.hour" class="timeline__hourly-row">
          <span class="timeline__hourly-label">{{ row.label }}</span>
          <div class="timeline__hourly-bar">
            <span
              v-if="row.sitMs"
              class="timeline__hourly-seg timeline__hourly-seg--sit"
              :style="{ width: `${segWidth(row.sitMs, row)}%` }"
            />
            <span
              v-for="(seg, segIndex) in hourlyBreakSegments(row)"
              :key="`${row.hour}-break-${segIndex}`"
              class="timeline__hourly-seg"
              :style="hourlyBreakSegStyle(seg, row)"
            />
            <span
              v-if="row.awayMs"
              class="timeline__hourly-seg timeline__hourly-seg--away"
              :style="{ width: `${segWidth(row.awayMs, row)}%` }"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="behaviorTags.length" class="timeline__tags">
      <h4>行为标签</h4>
      <div class="timeline__tag-list">
        <span v-for="(tag, i) in behaviorTags" :key="i" class="timeline__tag">
          {{ tag.time }} · {{ tag.label }} · {{ tag.duration }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import type { PauseRecord, WorkSession } from '@/types/session'
import {
  BREAK_REASON_ORDER,
  buildTimelineBlocks,
  buildHourlySummary,
  extractBehaviorTags,
  timelineBlockStyle,
  type BreakReasonKey,
  type HourlySummary
} from '@/utils/timelineBlocks'
import { STAND_REASON_COLORS, getStandReasonSolid } from '@/utils/standReasons'

const props = defineProps<{
  sessions: WorkSession[]
  date: string
  pauseRecords?: PauseRecord[]
}>()

const pauseList = computed(() => props.pauseRecords || [])

const blocks = computed(() => buildTimelineBlocks(props.sessions, props.date, pauseList.value))
const hourlyRows = computed(() => buildHourlySummary(props.sessions, props.date, pauseList.value))
const behaviorTags = computed(() => extractBehaviorTags(props.sessions, props.date, pauseList.value))

const legendReasons = computed(() => {
  const active = new Set<BreakReasonKey>()
  for (const block of blocks.value) {
    if (block.type === 'break' && block.standReason) {
      active.add(block.standReason)
    }
  }
  return BREAK_REASON_ORDER.filter((key) => active.has(key)).map((key) => ({
    key,
    label: STAND_REASON_COLORS[key].label,
    color: STAND_REASON_COLORS[key].solid
  }))
})

const MIN_ZOOM = 1
const MAX_ZOOM = 24

const zoom = ref(1)
const viewportRef = ref<HTMLElement | null>(null)

let isDragging = false
let dragStartX = 0
let dragStartScroll = 0

function segWidth(ms: number, row: HourlySummary): number {
  const total = row.sitMs + row.breakMs + row.awayMs
  if (total <= 0) return 0
  return Math.max(2, Math.round((ms / total) * 100))
}

function hourlyBreakSegments(row: HourlySummary): Array<{ reason: BreakReasonKey; ms: number }> {
  return BREAK_REASON_ORDER.filter((reason) => (row.breakByReason[reason] ?? 0) > 0).map(
    (reason) => ({
      reason,
      ms: row.breakByReason[reason] ?? 0
    })
  )
}

function hourlyBreakSegStyle(
  seg: { reason: BreakReasonKey; ms: number },
  row: HourlySummary
): Record<string, string> {
  const reason = seg.reason === 'unknown' ? undefined : seg.reason
  return {
    width: `${segWidth(seg.ms, row)}%`,
    background: getStandReasonSolid(reason)
  }
}

const contentStyle = computed(() => ({
  width: `${zoom.value * 100}%`
}))

const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`)

const hourMarks = computed(() => {
  if (zoom.value <= 1) return [0, 6, 12, 18, 24]
  if (zoom.value <= 4) {
    return Array.from({ length: 9 }, (_, i) => i * 3)
  }
  if (zoom.value <= 12) {
    return Array.from({ length: 25 }, (_, i) => i)
  }
  return Array.from({ length: 49 }, (_, i) => i * 0.5)
})

function hourStyle(hour: number): Record<string, string> {
  const pct = (hour / 24) * 100
  return {
    left: `${pct}%`
  }
}

function blockStyle(block: ReturnType<typeof buildTimelineBlocks>[number]) {
  return timelineBlockStyle(block, zoom.value > 4 ? 0.05 : 0.3)
}

function resetZoom(): void {
  zoom.value = 1
  if (viewportRef.value) {
    viewportRef.value.scrollLeft = 0
  }
}

function onWheel(event: WheelEvent): void {
  const viewport = viewportRef.value
  if (!viewport) return

  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12
  const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value * factor))
  if (nextZoom === zoom.value) return

  const rect = viewport.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const scrollRatio = (viewport.scrollLeft + mouseX) / Math.max(viewport.scrollWidth, 1)

  zoom.value = nextZoom

  nextTick(() => {
    if (!viewportRef.value) return
    const el = viewportRef.value
    el.scrollLeft = scrollRatio * el.scrollWidth - mouseX
  })
}

function onMouseDown(event: MouseEvent): void {
  if (zoom.value <= 1 || !viewportRef.value) return
  isDragging = true
  dragStartX = event.clientX
  dragStartScroll = viewportRef.value.scrollLeft
  document.body.style.cursor = 'grabbing'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(event: MouseEvent): void {
  if (!isDragging || !viewportRef.value) return
  viewportRef.value.scrollLeft = dragStartScroll - (event.clientX - dragStartX)
}

function onMouseUp(): void {
  isDragging = false
  document.body.style.cursor = ''
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

watch(
  () => props.date,
  () => {
    resetZoom()
  }
)

onUnmounted(() => {
  onMouseUp()
})
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.timeline {
  padding: 16px;
  border-radius: var(--radius-md);
  @include glass-surface;
  box-shadow: var(--shadow-card);
}

.timeline__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  min-height: 20px;
}

.timeline__zoom-hint {
  font-size: 11px;
  color: #94a3b8;
}

.timeline__zoom-level {
  font-size: 11px;
  color: #64748b;
  @include display-num;
}

.timeline__zoom-reset {
  margin-left: auto;
  padding: 2px 8px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  color: #64748b;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(255, 255, 255, 0.9);
    color: #334155;
  }
}

.timeline__viewport {
  overflow-x: auto;
  overflow-y: hidden;
  border-radius: 6px;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;

  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }

  &--draggable {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }
}

.timeline__content {
  min-width: 100%;
}

.timeline__hours {
  position: relative;
  height: 16px;
  margin-bottom: 8px;
}

.timeline__hour {
  position: absolute;
  transform: translateX(-50%);
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;

  &:first-child {
    transform: translateX(0);
  }

  &:last-child {
    transform: translateX(-100%);
  }
}

.timeline__track {
  position: relative;
  height: 28px;
  background: #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.timeline__block {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 4px;

  &--sit {
    background: linear-gradient(180deg, #f87171, #ef4444);
  }

  &--away {
    background: linear-gradient(180deg, #cbd5e1, #94a3b8);
  }
}

.timeline__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

.timeline__legend {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  font-size: 12px;
  color: #64748b;
  flex-wrap: wrap;

  span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.timeline__legend-hint {
  margin-left: auto;
  color: #94a3b8;
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;

  &--sit {
    background: #ef4444;
  }

  &--away {
    background: #94a3b8;
  }
}

.timeline__hourly {
  margin-top: 14px;

  h4 {
    margin: 0 0 8px;
    font-size: 13px;
    color: #64748b;
    font-weight: 600;
  }
}

.timeline__hourly-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
}

.timeline__hourly-row {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 8px;
  align-items: center;
}

.timeline__hourly-label {
  font-size: 11px;
  color: #94a3b8;
  @include display-num;
}

.timeline__hourly-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: #f1f5f9;
}

.timeline__hourly-seg {
  height: 100%;
  min-width: 2px;

  &--sit {
    background: #ef4444;
  }

  &--away {
    background: #94a3b8;
  }
}

.timeline__tags {
  margin-top: 14px;

  h4 {
    margin: 0 0 8px;
    font-size: 13px;
    color: #64748b;
    font-weight: 600;
  }
}

.timeline__tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.timeline__tag {
  font-size: 11px;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  padding: 4px 10px;
}
</style>
