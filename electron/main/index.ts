import { app, BrowserWindow, globalShortcut } from 'electron'
import { createTray, refreshTrayMenu, playTrayAlert } from './tray'
import { registerIpcHandlers } from './ipc'
import { settingsService } from './services/settingsService'
import { sessionService } from './services/sessionService'
import {
  initNotificationService,
  setNotificationActionHandler
} from './services/notificationService'
import { workScheduleService } from './services/workScheduleService'
import { focusGuardService } from './services/focusGuardService'
import { showReminderWindow } from './windows/reminderWindow'
import { ensureMainWindow, showMainWindow, updateTaskbarProgress } from './windows/mainWindow'
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

    setNotificationActionHandler((action) => {
      sessionService.handleToastAction(action)
      refreshTrayMenu()
    })

    ensureMainWindow()

    sessionService.onStateChange(onSessionChange)

    sessionService.onReminder(() => {
      playTrayAlert()
    })

    sessionService.onFullscreenReminder((sitMinutes) => {
      sessionService.onReminderShown()
      showReminderWindow(sitMinutes)
    })

    focusGuardService.setCallback(() => {
      sessionService.deferReminderForFullscreen()
      refreshTrayMenu()
    })
    focusGuardService.start()
    workScheduleService.start()

    createTray()

    globalShortcut.register('CommandOrControl+Alt+S', () => {
      sessionService.toggleSitStand()
    })

    setInterval(() => {
      sessionService.checkTimers()
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
  })

  app.on('before-quit', () => {
    app.isQuitting = true
  })
}
