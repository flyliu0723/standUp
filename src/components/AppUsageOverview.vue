<template>
  <section class="usage-overview">
    <div class="usage-overview__head">
      <div>
        <h3>软件使用</h3>
        <p class="usage-overview__note">辅助参考，核心看健康指标</p>
      </div>
      <span v-if="summary.totalTrackedMs > 0" class="usage-overview__total">
        已追踪 {{ formatUsageDuration(summary.totalTrackedMs) }}
      </span>
    </div>

    <div v-if="hasData" class="usage-overview__body">
      <div class="usage-overview__left">
        <div class="usage-overview__subtitle-row">
          <p class="usage-overview__subtitle">
            {{ selectedBrowser ? `${selectedBrowserLabel} 标签细分` : '应用占比' }}
          </p>
          <button
            v-if="selectedBrowser"
            type="button"
            class="usage-overview__back"
            @click="selectedBrowser = null"
          >
            ← 返回
          </button>
        </div>

        <div v-if="!selectedBrowser" class="usage-overview__treemap">
          <button
            v-for="app in visibleApps"
            :key="app.processName"
            type="button"
            class="usage-overview__tile"
            :class="{ 'usage-overview__tile--clickable': app.isBrowser }"
            :style="tileStyle(app)"
            :title="tileTitle(app)"
            @click="handleAppClick(app)"
          >
            <span class="usage-overview__tile-label">{{ app.label }}</span>
            <span class="usage-overview__tile-time">{{ formatUsageDuration(app.durationMs) }}</span>
            <span v-if="app.isBrowser && getBrowserSiteCount(app.processName) > 0" class="usage-overview__tile-hint">
              {{ getBrowserSiteCount(app.processName) }} 个站点 · 点击查看
            </span>
          </button>
        </div>

        <div v-else class="usage-overview__treemap">
          <div
            v-for="site in selectedBrowserSites"
            :key="site.siteKey"
            class="usage-overview__tile usage-overview__tile--site"
            :style="siteTileStyle(site)"
            :title="`${site.siteLabel} · ${formatUsageDuration(site.durationMs)}`"
          >
            <span class="usage-overview__tile-label">{{ site.siteLabel }}</span>
            <span class="usage-overview__tile-time">{{ formatUsageDuration(site.durationMs) }}</span>
          </div>
          <p v-if="selectedBrowserSites.length === 0" class="usage-overview__empty-inline">
            暂无标签数据，切换浏览器标签后会开始记录
          </p>
        </div>

        <p v-if="!selectedBrowser && hiddenAppCount > 0" class="usage-overview__more">
          另有 {{ hiddenAppCount }} 个应用未展示
        </p>
      </div>

      <div class="usage-overview__right">
        <p class="usage-overview__subtitle">分类占比</p>
        <div class="usage-overview__chart">
          <Doughnut :data="chartData" :options="chartOptions" />
        </div>
        <ul class="usage-overview__legend">
          <li v-for="item in summary.categoryTotals" :key="item.category">
            <i :style="{ background: APP_CATEGORY_COLORS[item.category] }" />
            <span>{{ item.label }}</span>
            <strong>{{ formatUsageDuration(item.durationMs) }}</strong>
          </li>
        </ul>
      </div>
    </div>

    <p v-else class="usage-overview__empty">
      暂无软件使用数据。开启「活动监测」并使用电脑后，这里会显示各应用时长。
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip
} from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import type { AppUsageAppTotal, AppUsageBrowserSiteTotal, AppUsageDailySummary } from '@/types/session'
import {
  APP_CATEGORY_COLORS,
  formatUsageDuration,
  formatUsagePercent
} from '@/utils/appUsage'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  summary: AppUsageDailySummary
}>()

const MAX_TILES = 8
const selectedBrowser = ref<string | null>(null)

const hasData = computed(() => props.summary.totalTrackedMs > 0)

const visibleApps = computed(() => props.summary.appTotals.slice(0, MAX_TILES))

const hiddenAppCount = computed(() =>
  Math.max(0, props.summary.appTotals.length - MAX_TILES)
)

const selectedBrowserLabel = computed(() => {
  if (!selectedBrowser.value) return ''
  const app = props.summary.appTotals.find((item) => item.processName === selectedBrowser.value)
  return app?.label ?? selectedBrowser.value
})

const selectedBrowserSites = computed(() => {
  if (!selectedBrowser.value) return []
  return props.summary.browserSiteTotals
    .filter((site) => site.processName === selectedBrowser.value)
    .slice(0, 12)
})

const selectedBrowserTotalMs = computed(() =>
  selectedBrowserSites.value.reduce((sum, site) => sum + site.durationMs, 0)
)

watch(
  () => props.summary.date,
  () => {
    selectedBrowser.value = null
  }
)

const chartData = computed(() => ({
  labels: props.summary.categoryTotals.map((item) => item.label),
  datasets: [
    {
      data: props.summary.categoryTotals.map((item) => Math.round(item.durationMs / 60_000)),
      backgroundColor: props.summary.categoryTotals.map(
        (item) => APP_CATEGORY_COLORS[item.category]
      ),
      borderWidth: 0
    }
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '62%',
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { parsed: number; dataIndex: number }) => {
          const item = props.summary.categoryTotals[ctx.dataIndex]
          if (!item) return ''
          return `${item.label}: ${formatUsageDuration(item.durationMs)}`
        }
      }
    }
  }
}

function getBrowserSiteCount(processName: string): number {
  return props.summary.browserSiteTotals.filter((site) => site.processName === processName).length
}

function handleAppClick(app: AppUsageAppTotal): void {
  if (!app.isBrowser) return
  if (getBrowserSiteCount(app.processName) === 0) return
  selectedBrowser.value = app.processName
}

function tileTitle(app: AppUsageAppTotal): string {
  const base = `${app.label} · ${formatUsageDuration(app.durationMs)} · ${formatUsagePercent(app.durationMs, props.summary.totalTrackedMs)}`
  if (app.isBrowser) {
    return `${base} · 点击查看标签细分`
  }
  return base
}

function tileStyle(app: AppUsageDailySummary['appTotals'][number]): Record<string, string> {
  const flexGrow = Math.max(1, app.durationMs)
  const minWidth = `${Math.max(18, Math.round((app.durationMs / props.summary.totalTrackedMs) * 100))}%`
  return {
    flexGrow: String(flexGrow),
    flexBasis: minWidth,
    background: APP_CATEGORY_COLORS[app.category]
  }
}

function siteTileStyle(site: AppUsageBrowserSiteTotal): Record<string, string> {
  const total = selectedBrowserTotalMs.value || site.durationMs
  const flexGrow = Math.max(1, site.durationMs)
  const minWidth = `${Math.max(18, Math.round((site.durationMs / total) * 100))}%`
  return {
    flexGrow: String(flexGrow),
    flexBasis: minWidth,
    background: APP_CATEGORY_COLORS[site.category]
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.usage-overview {
  @include glass-surface;
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-lg);
  padding: 16px 18px;
}

.usage-overview__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;

  h3 {
    margin: 0;
    font-size: 14px;
    color: #64748b;
    font-weight: 600;
  }
}

.usage-overview__note {
  margin: 4px 0 0;
  font-size: 11px;
  color: #94a3b8;
}

.usage-overview__total {
  font-size: 12px;
  color: #94a3b8;
  @include display-num;
}

.usage-overview__body {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 16px;
}

.usage-overview__subtitle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.usage-overview__subtitle {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

.usage-overview__back {
  border: none;
  background: transparent;
  color: #6366f1;
  font-size: 12px;
  cursor: pointer;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
}

.usage-overview__treemap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 140px;
  align-content: stretch;
}

.usage-overview__tile {
  box-sizing: border-box;
  min-height: 64px;
  padding: 10px 12px;
  border-radius: 10px;
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  border: none;
  text-align: left;

  &--clickable {
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.18);
    }
  }

  &--site {
    min-height: 58px;
  }
}

.usage-overview__tile-label {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.usage-overview__tile-time {
  font-size: 11px;
  opacity: 0.9;
  @include display-num;
}

.usage-overview__tile-hint {
  margin-top: 4px;
  font-size: 10px;
  opacity: 0.85;
}

.usage-overview__more,
.usage-overview__empty-inline {
  margin: 8px 0 0;
  font-size: 11px;
  color: #94a3b8;
  width: 100%;
}

.usage-overview__empty-inline {
  color: #94a3b8;
}

.usage-overview__chart {
  height: 140px;
  position: relative;
}

.usage-overview__legend {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  li {
    display: grid;
    grid-template-columns: 10px 1fr auto;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #64748b;

    i {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      display: inline-block;
    }

    strong {
      @include display-num;
      color: #334155;
      font-weight: 700;
    }
  }
}

.usage-overview__empty {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.6;
}
</style>
