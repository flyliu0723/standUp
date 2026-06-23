import { app, BrowserWindow, globalShortcut } from 'electron'
import { createTray, refreshTrayMenu, playTrayAlert } from './tray'
import { registerIpcHandlers } from './ipc'
import { settingsService } from './services/settingsService'
import { sessionService } from './services/sessionService'
import { recordLaunch } from './services/appMetaService'
import {
  initNotificationService
} from './services/notificationService'
import { workScheduleService } from './services/workScheduleService'
import { focusGuardService } from './services/focusGuardService'
import { activityMonitorService } from './services/activityMonitorService'
import { wellnessService } from './services/wellnessService'
import { microActionService } from './services/microActionService'
import { ensureMainWindow, showMainWindow, updateTaskbarProgress } from './windows/mainWindow'
import { syncAmbientDisplay, destroyAmbientDisplays, applyAmbientSettingsChange } from './services/ambientDisplayService'
import type { SessionStatus } from './types/session'

declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean
    }
  }
}

const gotLock = app.requestSingleInstanceLock()

function onSessionChange(status: SessionStatus): void {
  refreshTrayMenu(status)
  updateTaskbarProgress(status)
  syncAmbientDisplay(settingsService.getSettings(), status)
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('session:stateChange', status)
  })
}

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow('dashboard')
  })

  app.whenReady().then(() => {
    initNotificationService()
    settingsService.init()
    registerIpcHandlers()
    sessionService.init()

    ensureMainWindow()

    sessionService.onStateChange(onSessionChange)

    sessionService.onReminder(() => {
      playTrayAlert()
    })

    focusGuardService.setCallback(() => {
      sessionService.deferReminderForFullscreen()
      refreshTrayMenu()
    })
    focusGuardService.start()
    workScheduleService.start()

    const settings = settingsService.getSettings()
    if (settings.enableActivityMonitor) {
      activityMonitorService.start()
      if (sessionService.getStatus().state !== 'offDuty') {
        activityMonitorService.resumeUsageTracking()
      }
      wellnessService.start()
    }
    if (settings.enableMicroActionReminders) {
      microActionService.start()
    }

    createTray()

    syncAmbientDisplay(settingsService.getSettings(), sessionService.getStatus())

    const launchCount = recordLaunch()
    // 开发模式或首次启动时打开主界面，避免只有托盘图标时用户找不到应用
    if (!app.isPackaged || launchCount === 1) {
      showMainWindow('dashboard')
    }

    globalShortcut.register('CommandOrControl+Alt+S', () => {
      sessionService.toggleSitStand()
    })

    setInterval(() => {
      sessionService.checkTimers()
      const status = sessionService.getStatus()
      if (status.state === 'sitting' || status.state === 'standing') {
        refreshTrayMenu(status)
      }
    }, 1000)

    setInterval(() => {
      const status = sessionService.getStatus()
      if (
        status.state === 'sitting' ||
        status.state === 'standing' ||
        status.state === 'away' ||
        status.isPaused
      ) {
        sessionService.tickPersist()
        refreshTrayMenu(status)
        updateTaskbarProgress(status)
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('session:stateChange', sessionService.getStatus())
        })
      }
    }, 10_000)
  })

  app.on('window-all-closed', () => {
    // 托盘常驻，不退出
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    focusGuardService.stop()
    workScheduleService.stop()
    activityMonitorService.stop()
    wellnessService.stop()
    microActionService.stop()
    destroyAmbientDisplays()
  })

  app.on('before-quit', () => {
    app.isQuitting = true
  })
}
