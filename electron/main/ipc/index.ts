import { ipcMain } from 'electron'
import { sessionService } from '../services/sessionService'
import { settingsService } from '../services/settingsService'
import { statsService } from '../services/statsService'
import { gamificationService } from '../services/gamificationService'
import { activityMonitorService } from '../services/activityMonitorService'
import { microActionService } from '../services/microActionService'
import { appUsageService } from '../services/appUsageService'
import { listAppCategoryConfigs, reclassifyStoredUsageSegments } from '../services/appCategoryService'
import { aiAnalysisService } from '../services/aiAnalysisService'
import { wellnessService } from '../services/wellnessService'
import { buildDailyHealthSummary } from '../services/healthScoreEngine'
import { calcHealthMetrics } from '../services/insightsEngine'
import { updateStatusBarLayout } from '../windows/statusBarWindow'
import { listStatusBarPlacementOptions } from '../utils/statusBarPlacement'
import { applyAmbientSettingsChange } from '../services/ambientDisplayService'
import { closeReminderWindow } from '../windows/reminderWindow'
import {
  clearReminderEscalation,
  showReminderStandingPhase
} from '../services/reminderEscalation'
import { refreshTrayMenu } from '../tray'
import { showMainWindow } from '../windows/mainWindow'
import { AppSettings } from '../types/session'

export function registerIpcHandlers(): void {
  ipcMain.handle('reminder:confirm', () => {
    clearReminderEscalation()
    const minutes = sessionService.getReminderSitMinutes()
    const ok = sessionService.acknowledgeStand()
    if (ok) {
      showReminderStandingPhase(minutes)
    }
    refreshTrayMenu()
    return ok
  })

  ipcMain.handle('reminder:sitDown', () => {
    sessionService.sitDownFromReminder()
    closeReminderWindow()
    refreshTrayMenu()
    return true
  })

  ipcMain.handle('reminder:snooze', () => {
    clearReminderEscalation()
    const ok = sessionService.snoozeFromReminder()
    if (ok) {
      closeReminderWindow()
    }
    refreshTrayMenu()
    return ok
  })

  ipcMain.handle('reminder:deferIde', () => {
    const ok = sessionService.deferForIde()
    refreshTrayMenu()
    return ok
  })

  ipcMain.handle('reminder:force', () => {
    sessionService.forceReminderAfterIdeDefer()
    refreshTrayMenu()
    return true
  })

  ipcMain.handle('reminder:getMinutes', () => {
    return sessionService.getReminderSitMinutes()
  })

  ipcMain.handle('stats:today', () => {
    return statsService.getTodayStats()
  })

  ipcMain.handle('stats:byDate', (_event, date: string) => {
    return statsService.getStatsByDate(date)
  })

  ipcMain.handle('stats:history', () => {
    return statsService.getHistoryDates()
  })

  ipcMain.handle('settings:get', () => {
    return settingsService.getSettings()
  })

  ipcMain.handle('settings:save', (_event, partial: Partial<AppSettings>) => {
    const saved = sessionService.applySettingsChange(partial)
    if (partial.appCategoryOverrides !== undefined) {
      reclassifyStoredUsageSegments()
    }
    if (partial.enableActivityMonitor !== undefined) {
      if (saved.enableActivityMonitor) {
        activityMonitorService.start()
        wellnessService.start()
      } else {
        activityMonitorService.stop()
        wellnessService.stop()
      }
    }
    if (partial.enableMicroActionReminders !== undefined) {
      if (saved.enableMicroActionReminders && saved.enableActivityMonitor) {
        microActionService.start()
      } else {
        microActionService.stop()
      }
    }
    if (
      partial.statusBarDisplayId !== undefined ||
      partial.statusBarEdge !== undefined ||
      partial.ambientDisplayMode !== undefined
    ) {
      const status = sessionService.getStatus()
      applyAmbientSettingsChange(saved, status)
      updateStatusBarLayout()
    }
    refreshTrayMenu()
    return saved
  })

  ipcMain.handle('session:status', () => {
    return sessionService.getStatus()
  })

  ipcMain.handle('session:startWork', () => {
    sessionService.startWork()
    refreshTrayMenu()
  })

  ipcMain.handle('session:sitDown', () => {
    sessionService.sitDown()
    refreshTrayMenu()
  })

  ipcMain.handle('session:standUp', () => {
    sessionService.standUp()
    refreshTrayMenu()
  })

  ipcMain.handle('session:standUpWithReason', (_event, reasonId: string) => {
    sessionService.standUpWithReason(reasonId as import('../types/session').StandReasonId)
    refreshTrayMenu()
  })

  ipcMain.handle('session:endWork', () => {
    sessionService.endWork()
    refreshTrayMenu()
  })

  ipcMain.handle('session:toggle', () => {
    sessionService.toggleSitStand()
    refreshTrayMenu()
  })

  ipcMain.handle('session:pause', (_event, minutes: number) => {
    sessionService.pauseReminder(minutes)
    refreshTrayMenu()
  })

  ipcMain.handle('session:pauseUntilEndOfDay', () => {
    sessionService.pauseUntilEndOfDay()
    refreshTrayMenu()
  })

  ipcMain.handle('session:resumePause', () => {
    sessionService.resumeFromPause()
    refreshTrayMenu()
  })

  ipcMain.handle('stats:summary', (_event, date: string) => {
    return statsService.getReportSummary(date)
  })

  ipcMain.handle('gamification:get', () => {
    return gamificationService.getState()
  })

  ipcMain.handle('app:openMain', () => {
    showMainWindow('dashboard')
  })

  ipcMain.handle('activity:snapshot', () => {
    return activityMonitorService.getSnapshot()
  })

  ipcMain.handle('wellness:hud', () => {
    return wellnessService.getHudStatus()
  })

  ipcMain.handle('status-bar:placements', () => {
    return listStatusBarPlacementOptions()
  })

  ipcMain.handle('micro-action:dismiss', () => {
    microActionService.dismiss()
    return true
  })

  ipcMain.handle('app-usage:summary', (_event, date: string) => {
    return appUsageService.getDailySummary(date)
  })

  ipcMain.handle('app-categories:list', () => {
    return listAppCategoryConfigs()
  })

  ipcMain.handle('health:dailySummary', () => {
    statsService.checkDateRollover()
    const daily = statsService.getTodayStats()
    const activity = activityMonitorService.getSnapshot()
    const healthMetrics = calcHealthMetrics(daily)
    const settings = settingsService.getSettings()
    const status = sessionService.getStatus()
    return buildDailyHealthSummary({
      activity,
      daily,
      healthMetrics,
      sitIntervalMinutes: settings.sitIntervalMinutes,
      currentSitMs: status.currentSitMs,
      recentSwitchApps: activityMonitorService.getRecentSwitchApps()
    })
  })

  ipcMain.handle('ai:getAnalysis', (_event, date: string) => {
    return aiAnalysisService.getAnalysis(date)
  })

  ipcMain.handle('ai:generate', (_event, date: string, force?: boolean) => {
    return aiAnalysisService.generate(date, { force: Boolean(force) })
  })
}
