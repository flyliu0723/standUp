import { BrowserWindow, app, screen } from 'electron'
import { join } from 'path'
import { settingsService } from '../services/settingsService'
import {
  resolveStatusBarLayout,
  type StatusBarLayout
} from '../utils/statusBarPlacement'

let statusBarWindow: BrowserWindow | null = null
let displayListenersBound = false

function getRendererUrl(hash: string): string {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}#${hash}`
  }
  return `file://${join(__dirname, '../renderer/index.html')}#${hash}`
}

function getLayoutFromSettings(): StatusBarLayout {
  const settings = settingsService.getSettings()
  return resolveStatusBarLayout(settings.statusBarDisplayId, settings.statusBarEdge)
}

function applyLayoutToWindow(win: BrowserWindow, layout: StatusBarLayout): void {
  win.setBounds({
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height
  })
  win.webContents.send('status-bar:layout', layout)
}

export function updateStatusBarLayout(): void {
  if (!statusBarWindow || statusBarWindow.isDestroyed()) {
    return
  }
  applyLayoutToWindow(statusBarWindow, getLayoutFromSettings())
}

function bindDisplayListeners(): void {
  if (displayListenersBound) {
    return
  }
  displayListenersBound = true
  const refresh = (): void => {
    updateStatusBarLayout()
  }
  screen.on('display-added', refresh)
  screen.on('display-removed', refresh)
  screen.on('display-metrics-changed', refresh)
}

export function showStatusBarWindow(): void {
  const layout = getLayoutFromSettings()

  if (statusBarWindow && !statusBarWindow.isDestroyed()) {
    applyLayoutToWindow(statusBarWindow, layout)
    statusBarWindow.showInactive()
    return
  }

  statusBarWindow = new BrowserWindow({
    width: layout.width,
    height: layout.height,
    x: layout.x,
    y: layout.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    hasShadow: false,
    thickFrame: false,
    roundedCorners: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  statusBarWindow.setAlwaysOnTop(true, 'screen-saver')
  statusBarWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  statusBarWindow.loadURL(getRendererUrl('/status-bar'))

  statusBarWindow.once('ready-to-show', () => {
    if (!statusBarWindow || statusBarWindow.isDestroyed()) {
      return
    }
    applyLayoutToWindow(statusBarWindow, getLayoutFromSettings())
    statusBarWindow.showInactive()
  })

  bindDisplayListeners()
}

export function hideStatusBarWindow(): void {
  if (statusBarWindow && !statusBarWindow.isDestroyed()) {
    statusBarWindow.hide()
  }
}

export function closeStatusBarWindow(): void {
  if (statusBarWindow && !statusBarWindow.isDestroyed()) {
    statusBarWindow.destroy()
  }
  statusBarWindow = null
}

export function getStatusBarWindow(): BrowserWindow | null {
  return statusBarWindow && !statusBarWindow.isDestroyed() ? statusBarWindow : null
}
