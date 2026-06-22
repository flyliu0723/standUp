import { BrowserWindow, app, screen } from 'electron'
import { join } from 'path'

let overlayWindow: BrowserWindow | null = null

function getRendererUrl(hash: string): string {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}#${hash}`
  }
  return `file://${join(__dirname, '../renderer/index.html')}#${hash}`
}

export function showReminderOverlayWindow(sitMinutes: number): void {
  closeReminderOverlayWindow()

  const display = screen.getPrimaryDisplay()
  const { width, height } = display.bounds

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: display.bounds.x,
    y: display.bounds.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  overlayWindow.loadURL(getRendererUrl('/reminder-overlay'))

  overlayWindow.once('ready-to-show', () => {
    overlayWindow?.showInactive()
    overlayWindow?.webContents.send('reminder:minutes', sitMinutes)
  })
}

export function closeReminderOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy()
  }
  overlayWindow = null
}

export function getReminderOverlayWindow(): BrowserWindow | null {
  return overlayWindow && !overlayWindow.isDestroyed() ? overlayWindow : null
}
