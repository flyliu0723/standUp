<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="themeOverrides">
    <n-message-provider>
      <div class="shell" :class="mainStateClass">
        <TitleBar />

        <div class="shell__body">
          <aside class="shell__sidebar">
            <div class="shell__brand">
              <span class="shell__logo">standUp</span>
              <span class="shell__tagline">久坐提醒</span>
            </div>

            <nav class="shell__nav">
              <button
                v-for="item in navItems"
                :key="item.key"
                type="button"
                class="shell__nav-item"
                :class="{ 'shell__nav-item--active': activeTab === item.key }"
                @click="activeTab = item.key"
              >
                <span class="shell__nav-icon" v-html="item.icon" />
                <span class="shell__nav-label">{{ item.label }}</span>
              </button>
            </nav>

            <div class="shell__sidebar-foot">
              <StatusBadge
                :state="status.state"
                :is-paused="status.isPaused"
                :is-inactive-paused="status.isInactivePaused"
              />
            </div>
          </aside>

          <main class="shell__main">
            <div class="shell__content" :key="activeTab">
              <DashboardView v-if="activeTab === 'dashboard'" />
              <ReportView v-else-if="activeTab === 'report'" embedded />
              <SettingsView v-else-if="activeTab === 'settings'" embedded />
              <GuideView v-else-if="activeTab === 'guide'" />
            </div>
          </main>
        </div>
      </div>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import { zhCN, dateZhCN } from 'naive-ui/es/locales'
import TitleBar from '@/components/TitleBar.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import DashboardView from '@/views/DashboardView.vue'
import ReportView from '@/views/ReportView.vue'
import SettingsView from '@/views/SettingsView.vue'
import GuideView from '@/views/GuideView.vue'
import { useSessionStatus } from '@/composables/useSessionStatus'
import { themeOverrides } from '@/styles/naive-theme'
import type { MainTab } from '@/env.d'

const NAV_ITEMS: { key: MainTab; label: string; icon: string }[] = [
  {
    key: 'dashboard',
    label: '概览',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>'
  },
  {
    key: 'report',
    label: '报告',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-6 4 3 5-8"/></svg>'
  },
  {
    key: 'settings',
    label: '设置',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
  },
  {
    key: 'guide',
    label: '指南',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'
  }
]

const route = useRoute()
const activeTab = ref<MainTab>('dashboard')
const navItems = NAV_ITEMS
const { status } = useSessionStatus(1000)

let navigateUnsub: (() => void) | null = null

const mainStateClass = computed(() => {
  if (status.value.isPaused || status.value.state === 'paused') {
    return 'shell--paused'
  }
  if (status.value.state === 'sitting' && status.value.timerMode === 'sit') {
    const intervalMs = status.value.sitIntervalMinutes * 60_000
    const progress = status.value.timerRemainingMs / Math.max(intervalMs, 1)
    if (progress <= 0.08) return 'shell--urgent'
    if (progress <= 0.25) return 'shell--warning'
  }
  return `shell--${status.value.state}`
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

.shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background: transparent;

  &::before {
    content: '';
    position: absolute;
    top: var(--titlebar-height);
    left: 0;
    right: 0;
    height: 2px;
    z-index: 3;
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

.shell__body {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
  z-index: 1;
}

.shell__sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: var(--space-md) var(--space-sm);
  background: var(--color-sidebar);
  backdrop-filter: blur(20px) saturate(1.1);
  -webkit-backdrop-filter: blur(20px) saturate(1.1);
  box-shadow: var(--shadow-sidebar);
  border-right: 1px solid var(--color-border-subtle);
}

.shell__brand {
  padding: var(--space-xs) var(--space-sm) var(--space-lg);
}

.shell__logo {
  display: block;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.shell__tagline {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: #94a3b8;
}

.shell__nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.shell__nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(255, 255, 255, 0.7);
    color: #334155;
  }

  &--active {
    background: var(--color-primary);
    color: #fff;
    box-shadow: 0 4px 14px rgba(22, 163, 74, 0.28);

    &:hover {
      background: var(--color-primary-hover);
      color: #fff;
    }

    .shell__nav-icon :deep(svg) {
      stroke: #fff;
    }
  }
}

.shell__nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.9;
}

.shell__nav-label {
  line-height: 1;
}

.shell__sidebar-foot {
  padding: var(--space-sm);
  display: flex;
  justify-content: center;
}

.shell__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.shell__content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg) var(--space-lg) var(--space-xl);
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
  animation: pane-enter var(--duration-normal) var(--ease-out);

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.35);
    border-radius: var(--radius-pill);
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

@keyframes pane-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
