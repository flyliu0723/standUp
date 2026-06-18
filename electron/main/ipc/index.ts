import { ipcMain } from 'electron'
import { sessionService } from '../services/sessionService'
import { settingsService } from '../services/settingsService'
import { statsService } from '../services/statsService'
import { gamificationService } from '../services/gamificationService'
import { closeReminderWindow, sendReminderPhase } from '../windows/reminderWindow'
import { refreshTrayMenu } from '../tray'
import { AppSettings } from '../types/session'

export function registerIpcHandlers(): void {
  ipcMain.handle('reminder:confirm', () => {
    const ok = sessionService.acknowledgeStand()
    if (ok) {
      sendReminderPhase('standing')
    }
    refreshTrayMenu()
    return ok
  })

  ipcMain.handle('reminder:sitDown', () => {
    sessionService.sitDownFromReminder()
    refreshTrayMenu()
    return true
  })

  ipcMain.handle('reminder:snooze', () => {
    const ok = sessionService.snoozeFromReminder()
    if (ok) {
      closeReminderWindow()
    }
    refreshTrayMenu()
    return ok
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
}
