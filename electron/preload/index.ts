import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  ActivitySnapshot,
  AiDailyAnalysis,
  WellnessHudStatus,
  AppUsageDailySummary,
  AppCategoryConfigItem,
  DailyHealthSummary,
  DailyStats,
  GamificationState,
  ReportSummary,
  SessionStatus,
  StatusBarPlacementOption,
  StatusBarLayoutInfo,
  StandReasonId
} from '../main/types/session'
import type { ReminderPhase } from '../main/windows/reminderWindow'

export type MainTab = 'dashboard' | 'report' | 'settings' | 'guide'

export interface StandUpApi {
  confirmReminder: () => Promise<boolean>
  sitDownFromReminder: () => Promise<boolean>
  snoozeReminder: () => Promise<boolean>
  getReminderMinutes: () => Promise<number>
  onReminderMinutes: (callback: (minutes: number) => void) => () => void
  onReminderPhase: (callback: (phase: ReminderPhase) => void) => () => void
  getTodayStats: () => Promise<DailyStats>
  getStatsByDate: (date: string) => Promise<DailyStats>
  getHistory: () => Promise<string[]>
  getSettings: () => Promise<AppSettings>
  saveSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  getSessionStatus: () => Promise<SessionStatus>
  onStateChange: (callback: (status: SessionStatus) => void) => () => void
  onNavigate: (callback: (tab: MainTab) => void) => () => void
  startWork: () => Promise<void>
  sitDown: () => Promise<void>
  standUp: () => Promise<void>
  standUpWithReason: (reasonId: StandReasonId) => Promise<void>
  endWork: () => Promise<void>
  toggleSitStand: () => Promise<void>
  pauseReminder: (minutes: number) => Promise<void>
  pauseUntilEndOfDay: () => Promise<void>
  resumePause: () => Promise<void>
  getReportSummary: (date: string) => Promise<ReportSummary>
  getGamification: () => Promise<GamificationState>
  openMainWindow: () => Promise<void>
  deferForIde: () => Promise<boolean>
  forceReminder: () => Promise<boolean>
  onIdeDeferContext: (
    callback: (ctx: { ideLabel: string; snoozeMinutes: number }) => void
  ) => () => void
  getActivitySnapshot: () => Promise<ActivitySnapshot>
  getWellnessHud: () => Promise<WellnessHudStatus>
  onWellnessHudChange: (callback: (hud: WellnessHudStatus) => void) => () => void
  getStatusBarPlacements: () => Promise<StatusBarPlacementOption[]>
  onStatusBarLayout: (callback: (layout: StatusBarLayoutInfo) => void) => () => void
  dismissMicroAction: () => Promise<boolean>
  onMicroActionContext: (
    callback: (ctx: { id: string; emoji: string; title: string; body: string }) => void
  ) => () => void
  getAppUsageSummary: (date: string) => Promise<AppUsageDailySummary>
  getAppCategoryList: () => Promise<AppCategoryConfigItem[]>
  getDailyHealthSummary: () => Promise<DailyHealthSummary>
  getAiAnalysis: (date: string) => Promise<AiDailyAnalysis | null>
  generateAiAnalysis: (date: string, force?: boolean) => Promise<AiDailyAnalysis>
  windowMinimize: () => Promise<void>
  windowClose: () => Promise<void>
}

const api: StandUpApi = {
  confirmReminder: () => ipcRenderer.invoke('reminder:confirm'),
  sitDownFromReminder: () => ipcRenderer.invoke('reminder:sitDown'),
  snoozeReminder: () => ipcRenderer.invoke('reminder:snooze'),
  getReminderMinutes: () => ipcRenderer.invoke('reminder:getMinutes'),
  onReminderMinutes: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, minutes: number) => callback(minutes)
    ipcRenderer.on('reminder:minutes', handler)
    return () => ipcRenderer.removeListener('reminder:minutes', handler)
  },
  onReminderPhase: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, phase: ReminderPhase) => callback(phase)
    ipcRenderer.on('reminder:phase', handler)
    return () => ipcRenderer.removeListener('reminder:phase', handler)
  },
  getTodayStats: () => ipcRenderer.invoke('stats:today'),
  getStatsByDate: (date) => ipcRenderer.invoke('stats:byDate', date),
  getHistory: () => ipcRenderer.invoke('stats:history'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (partial) => ipcRenderer.invoke('settings:save', partial),
  getSessionStatus: () => ipcRenderer.invoke('session:status'),
  onStateChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, status: SessionStatus) => callback(status)
    ipcRenderer.on('session:stateChange', handler)
    return () => ipcRenderer.removeListener('session:stateChange', handler)
  },
  onNavigate: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, tab: MainTab) => callback(tab)
    ipcRenderer.on('main:navigate', handler)
    return () => ipcRenderer.removeListener('main:navigate', handler)
  },
  startWork: () => ipcRenderer.invoke('session:startWork'),
  sitDown: () => ipcRenderer.invoke('session:sitDown'),
  standUp: () => ipcRenderer.invoke('session:standUp'),
  standUpWithReason: (reasonId) => ipcRenderer.invoke('session:standUpWithReason', reasonId),
  endWork: () => ipcRenderer.invoke('session:endWork'),
  toggleSitStand: () => ipcRenderer.invoke('session:toggle'),
  pauseReminder: (minutes) => ipcRenderer.invoke('session:pause', minutes),
  pauseUntilEndOfDay: () => ipcRenderer.invoke('session:pauseUntilEndOfDay'),
  resumePause: () => ipcRenderer.invoke('session:resumePause'),
  getReportSummary: (date) => ipcRenderer.invoke('stats:summary', date),
  getGamification: () => ipcRenderer.invoke('gamification:get'),
  openMainWindow: () => ipcRenderer.invoke('app:openMain'),
  deferForIde: () => ipcRenderer.invoke('reminder:deferIde'),
  forceReminder: () => ipcRenderer.invoke('reminder:force'),
  onIdeDeferContext: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      ctx: { ideLabel: string; snoozeMinutes: number }
    ) => callback(ctx)
    ipcRenderer.on('ide-defer:context', handler)
    return () => ipcRenderer.removeListener('ide-defer:context', handler)
  },
  getActivitySnapshot: () => ipcRenderer.invoke('activity:snapshot'),
  getWellnessHud: () => ipcRenderer.invoke('wellness:hud'),
  onWellnessHudChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, hud: WellnessHudStatus) => callback(hud)
    ipcRenderer.on('wellness:hudChange', handler)
    return () => ipcRenderer.removeListener('wellness:hudChange', handler)
  },
  getStatusBarPlacements: () => ipcRenderer.invoke('status-bar:placements'),
  onStatusBarLayout: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, layout: StatusBarLayoutInfo) => callback(layout)
    ipcRenderer.on('status-bar:layout', handler)
    return () => ipcRenderer.removeListener('status-bar:layout', handler)
  },
  dismissMicroAction: () => ipcRenderer.invoke('micro-action:dismiss'),
  onMicroActionContext: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      ctx: { id: string; emoji: string; title: string; body: string }
    ) => callback(ctx)
    ipcRenderer.on('micro-action:context', handler)
    return () => ipcRenderer.removeListener('micro-action:context', handler)
  },
  getAppUsageSummary: (date) => ipcRenderer.invoke('app-usage:summary', date),
  getAppCategoryList: () => ipcRenderer.invoke('app-categories:list'),
  getDailyHealthSummary: () => ipcRenderer.invoke('health:dailySummary'),
  getAiAnalysis: (date) => ipcRenderer.invoke('ai:getAnalysis', date),
  generateAiAnalysis: (date, force) => ipcRenderer.invoke('ai:generate', date, force),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowClose: () => ipcRenderer.invoke('window:close')
}

contextBridge.exposeInMainWorld('standUp', api)
