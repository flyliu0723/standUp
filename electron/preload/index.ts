import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  DailyStats,
  GamificationState,
  ReportSummary,
  SessionStatus
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
  endWork: () => Promise<void>
  toggleSitStand: () => Promise<void>
  pauseReminder: (minutes: number) => Promise<void>
  pauseUntilEndOfDay: () => Promise<void>
  resumePause: () => Promise<void>
  getReportSummary: (date: string) => Promise<ReportSummary>
  getGamification: () => Promise<GamificationState>
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
  endWork: () => ipcRenderer.invoke('session:endWork'),
  toggleSitStand: () => ipcRenderer.invoke('session:toggle'),
  pauseReminder: (minutes) => ipcRenderer.invoke('session:pause', minutes),
  pauseUntilEndOfDay: () => ipcRenderer.invoke('session:pauseUntilEndOfDay'),
  resumePause: () => ipcRenderer.invoke('session:resumePause'),
  getReportSummary: (date) => ipcRenderer.invoke('stats:summary', date),
  getGamification: () => ipcRenderer.invoke('gamification:get')
}

contextBridge.exposeInMainWorld('standUp', api)
