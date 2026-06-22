<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN">
    <n-message-provider>
      <div class="main" :class="mainStateClass">
      <header class="main__header">
        <div class="main__brand">
          <span class="main__logo">standUp</span>
          <span class="main__subtitle">久坐提醒</span>
          <StatusBadge
            :state="status.state"
            :is-paused="status.isPaused"
            :is-inactive-paused="status.isInactivePaused"
          />
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
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { NConfigProvider, NMessageProvider, NTabs, NTabPane } from 'naive-ui'
import { zhCN, dateZhCN } from 'naive-ui/es/locales'
import StatusBadge from '@/components/StatusBadge.vue'
import DashboardView from '@/views/DashboardView.vue'
import ReportView from '@/views/ReportView.vue'
import SettingsView from '@/views/SettingsView.vue'
import GuideView from '@/views/GuideView.vue'
import { useSessionStatus } from '@/composables/useSessionStatus'

type MainTab = 'dashboard' | 'report' | 'settings' | 'guide'

const route = useRoute()
const activeTab = ref<MainTab>('dashboard')
const { status } = useSessionStatus(1000)

let navigateUnsub: (() => void) | null = null

const mainStateClass = computed(() => {
  if (status.value.isPaused || status.value.state === 'paused') {
    return 'main--paused'
  }
  if (status.value.state === 'sitting' && status.value.timerMode === 'sit') {
    const intervalMs = status.value.sitIntervalMinutes * 60_000
    const progress = status.value.timerRemainingMs / Math.max(intervalMs, 1)
    if (progress <= 0.08) return 'main--urgent'
    if (progress <= 0.25) return 'main--warning'
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

  &--warning::before {
    background: linear-gradient(90deg, transparent, var(--color-glow-warning), transparent);
    animation: breath-glow 2s ease-in-out infinite;
  }

  &--urgent::before {
    background: linear-gradient(90deg, transparent, var(--color-glow-danger), transparent);
    animation: breath-glow 1.2s ease-in-out infinite;
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
  color: #16a34a;
  letter-spacing: -0.02em;
}

.main__subtitle {
  font-size: 13px;
  color: #94a3b8;
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
