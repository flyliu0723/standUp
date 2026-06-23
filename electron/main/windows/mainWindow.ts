import { BrowserWindow, app, shell } from 'electron'
import { join } from 'path'
import { sessionService } from '../services/sessionService'
import { loadWindowIcon } from '../utils/trayIcon'
import type { SessionStatus } from '../types/session'

let mainWindow: BrowserWindow | null = null

function getRendererUrl(hash: string): string {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}#${hash}`
  }
  return `file://${join(__dirname, '../renderer/index.html')}#${hash}`
}

export type MainTab = 'dashboard' | 'report' | 'settings' | 'guide'

function createMainWindow(show = false, tab: MainTab = 'dashboard'): BrowserWindow {
  const windowIcon = loadWindowIcon()
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 720,
    minHeight: 560,
    show,
    frame: false,
    autoHideMenuBar: true,
    title: 'standUp — 久坐提醒',
    icon: windowIcon,
    backgroundColor: '#eef1f500',
    ...(process.platform === 'win32' ? { backgroundMaterial: 'mica' as const } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.loadURL(getRendererUrl(`/main?tab=${tab}`))

  if (show) {
    mainWindow.once('ready-to-show', () => {
      mainWindow?.show()
      mainWindow?.webContents.send('main:navigate', tab)
    })
  }

  return mainWindow
}

export function ensureMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow
  }
  return createMainWindow(false)
}

export function showMainWindow(tab: MainTab = 'dashboard'): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send('main:navigate', tab)
    return
  }

  createMainWindow(true, tab)
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function minimizeMainWindow(): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.minimize()
  }
}

export function hideMainWindow(): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.hide()
  }
}

export function updateTaskbarProgress(status: SessionStatus): void {
  const main = ensureMainWindow()
  if (main.isDestroyed()) {
    return
  }
  if (status.isPaused) {
    main.setProgressBar(-1)
    return
  }
  if (status.state === 'sitting' && status.timerMode === 'sit') {
    const total = status.sitIntervalMinutes * 60 * 1000
    const remaining = status.timerRemainingMs
    if (total > 0 && remaining > 0) {
      main.setProgressBar(remaining / total, { mode: 'normal' })
      return
    }
  }
  if (status.state === 'standing' && status.timerMode === 'stand') {
    const total = status.standTimerTotalMs || status.standIntervalMinutes * 60 * 1000
    const remaining = status.timerRemainingMs
    if (total > 0 && remaining > 0) {
      main.setProgressBar(remaining / total, { mode: 'paused' })
      return
    }
  }
  main.setProgressBar(-1)
}
