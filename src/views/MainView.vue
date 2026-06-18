<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN">
    <div class="main" :class="mainStateClass">
      <header class="main__header">
        <div class="main__brand">
          <span class="main__logo">standUp</span>
          <span class="main__subtitle">久坐提醒</span>
          <StatusBadge :state="status.state" :is-paused="status.isPaused" />
        </div>
        <div v-if="showCountdown" class="main__countdown">
          <CountdownRing
            :timer-remaining-ms="status.timerRemainingMs"
            :timer-mode="status.timerMode"
            :sit-interval-minutes="status.sitIntervalMinutes"
            :stand-interval-minutes="status.standIntervalMinutes"
            :work-state="status.state"
          />
          <div class="main__countdown-meta">
            <span class="main__countdown-label">{{ countdownLabel }}</span>
            <span class="main__countdown-value">{{ countdownText }}</span>
          </div>
        </div>
      </header>

      <n-tabs v-model:value="activeTab" type="line" animated class="main__tabs">
        <n-tab-pane name="dashboard" tab="概览">
          <div class="main__pane" :key="`pane-${activeTab}`">
            <DashboardView />
          </div>
        </n-tab-pane>
        <n-tab-pane name="report" tab="报告">
          <div class="main__pane" :key="`pane-${activeTab}`">
            <ReportView embedded />
          </div>
        </n-tab-pane>
        <n-tab-pane name="settings" tab="设置">
          <div class="main__pane" :key="`pane-${activeTab}`">
            <SettingsView embedded />
          </div>
        </n-tab-pane>
        <n-tab-pane name="guide" tab="指南">
          <div class="main__pane" :key="`pane-${activeTab}`">
            <GuideView />
          </div>
        </n-tab-pane>
      </n-tabs>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { NConfigProvider, NTabs, NTabPane } from 'naive-ui'
import { zhCN, dateZhCN } from 'naive-ui/es/locales'
import StatusBadge from '@/components/StatusBadge.vue'
import CountdownRing from '@/components/CountdownRing.vue'
import DashboardView from '@/views/DashboardView.vue'
import ReportView from '@/views/ReportView.vue'
import SettingsView from '@/views/SettingsView.vue'
import GuideView from '@/views/GuideView.vue'
import { useSessionStatus, formatCountdown } from '@/composables/useSessionStatus'

type MainTab = 'dashboard' | 'report' | 'settings' | 'guide'

const route = useRoute()
const activeTab = ref<MainTab>('dashboard')
const { status } = useSessionStatus(1000)

let navigateUnsub: (() => void) | null = null

const showCountdown = computed(() => {
  if (status.value.isPaused || status.value.state === 'away') {
    return false
  }
  return status.value.timerMode === 'sit' || status.value.timerMode === 'stand'
})

const countdownLabel = computed(() =>
  status.value.timerMode === 'stand' ? '距坐下提醒' : '距下次提醒'
)

const countdownText = computed(() => formatCountdown(status.value.timerRemainingMs))

const mainStateClass = computed(() => {
  if (status.value.isPaused || status.value.state === 'paused') {
    return 'main--paused'
  }
  return `main--${status.value.state}`
})

function applyTab(tab: string): void {
  const valid: MainTab[] = ['dashboard', 'report', 'settings', 'guide']
  if (valid.includes(tab as MainTab)) {
    activeTab.value = tab as MainTab
  }
}

onMounted(() => {
  const tab = (route.query.tab as string) || 'dashboard'
  applyTab(tab)
  navigateUnsub = window.standUp.onNavigate((tab) => {
    applyTab(tab)
  })
})

onUnmounted(() => {
  navigateUnsub?.()
})
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.main {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: transparent;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    z-index: 1;
    pointer-events: none;
    transition: background var(--duration-fast) var(--ease-out);
  }

  &--sitting::before {
    background: linear-gradient(90deg, transparent, var(--color-glow-sitting), transparent);
    animation: breath-glow var(--duration-breath) ease-in-out infinite;
  }

  &--standing::before {
    background: linear-gradient(90deg, transparent, var(--color-glow-standing), transparent);
    animation: breath-glow var(--duration-breath) ease-in-out infinite;
  }

  &--away::before,
  &--offDuty::before,
  &--paused::before {
    background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.2), transparent);
  }
}

@keyframes breath-glow {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

.main__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px 0;
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}

.main__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.main__logo {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-state-sitting);
  letter-spacing: -0.02em;
}

.main__subtitle {
  font-size: 13px;
  color: #94a3b8;
}

.main__countdown {
  display: flex;
  align-items: center;
  gap: 10px;
}

.main__countdown-meta {
  text-align: right;
}

.main__countdown-label {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 2px;
}

.main__countdown-value {
  @include display-num;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-state-sitting);
  font-variant-numeric: tabular-nums;
}

.main--standing .main__countdown-value {
  color: var(--color-state-standing);
}

.main__tabs {
  flex: 1;
  padding: 0 16px 12px;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 2;

  :deep(.n-tabs-nav) {
    flex-shrink: 0;
  }

  :deep(.n-tab-pane) {
    height: 100%;
  }

  :deep(.n-tabs-pane-wrapper) {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding: 12px 8px 0;
    scrollbar-width: thin;
    scrollbar-color: #e2e8f0 transparent;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: #e2e8f0;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }
  }
}

.main__pane {
  animation: pane-enter var(--duration-fast) var(--ease-out);
}

@keyframes pane-enter {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
