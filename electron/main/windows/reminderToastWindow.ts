import { BrowserWindow, app, screen } from 'electron'
import { join } from 'path'

const TOAST_WIDTH = 340
const TOAST_HEIGHT = 172
const IDE_DEFER_HEIGHT = 210
const MARGIN = 20

let toastWindow: BrowserWindow | null = null

function getRendererUrl(hash: string): string {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}#${hash}`
  }
  return `file://${join(__dirname, '../renderer/index.html')}#${hash}`
}

function getBottomRightPosition(): { x: number; y: number } {
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.workAreaSize
  const { x: workX, y: workY } = display.workArea
  return {
    x: workX + width - TOAST_WIDTH - MARGIN,
    y: workY + height - TOAST_HEIGHT - MARGIN
  }
}

export function showReminderToastWindow(sitMinutes: number): void {
  closeReminderToastWindow()

  const pos = getBottomRightPosition()

  toastWindow = new BrowserWindow({
    width: TOAST_WIDTH,
    height: TOAST_HEIGHT,
    x: pos.x,
    y: pos.y + 24,
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

  toastWindow.setAlwaysOnTop(true, 'pop-up-menu')
  toastWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  toastWindow.loadURL(getRendererUrl('/reminder-toast'))

  toastWindow.once('ready-to-show', () => {
    if (!toastWindow || toastWindow.isDestroyed()) return
    const target = getBottomRightPosition()
    toastWindow.setBounds({ x: target.x, y: target.y, width: TOAST_WIDTH, height: TOAST_HEIGHT })
    toastWindow.showInactive()
    toastWindow.webContents.send('reminder:minutes', sitMinutes)
  })
}

export function showIdeDeferWindow(
  ideLabel: string,
  snoozeMinutes: number,
  onReady?: () => void
): void {
  closeReminderToastWindow()

  const pos = getBottomRightPosition()

  toastWindow = new BrowserWindow({
    width: TOAST_WIDTH,
    height: IDE_DEFER_HEIGHT,
    x: pos.x,
    y: pos.y + 24,
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

  toastWindow.setAlwaysOnTop(true, 'pop-up-menu')
  toastWindow.loadURL(getRendererUrl('/ide-defer'))

  toastWindow.once('ready-to-show', () => {
    if (!toastWindow || toastWindow.isDestroyed()) return
    const target = getBottomRightPosition()
    toastWindow.setBounds({
      x: target.x,
      y: target.y,
      width: TOAST_WIDTH,
      height: IDE_DEFER_HEIGHT
    })
    toastWindow.showInactive()
    toastWindow.webContents.send('ide-defer:context', { ideLabel, snoozeMinutes })
    onReady?.()
  })
}

export function closeReminderToastWindow(): void {
  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.destroy()
  }
  toastWindow = null
}

export function getReminderToastWindow(): BrowserWindow | null {
  return toastWindow && !toastWindow.isDestroyed() ? toastWindow : null
}
