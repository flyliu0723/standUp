import { BrowserWindow, app, screen } from 'electron'
import { join } from 'path'

const TOAST_WIDTH = 320
const TOAST_HEIGHT = 148
const MARGIN = 20

let microActionWindow: BrowserWindow | null = null
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null

export interface MicroActionPayload {
  id: string
  emoji: string
  title: string
  body: string
}

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

export function showMicroActionToastWindow(payload: MicroActionPayload): void {
  closeMicroActionToastWindow()

  const pos = getBottomRightPosition()

  microActionWindow = new BrowserWindow({
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

  microActionWindow.setAlwaysOnTop(true, 'pop-up-menu')
  microActionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  microActionWindow.loadURL(getRendererUrl('/micro-action'))

  microActionWindow.once('ready-to-show', () => {
    if (!microActionWindow || microActionWindow.isDestroyed()) return
    const target = getBottomRightPosition()
    microActionWindow.setBounds({ x: target.x, y: target.y, width: TOAST_WIDTH, height: TOAST_HEIGHT })
    microActionWindow.showInactive()
    microActionWindow.webContents.send('micro-action:context', payload)
  })

  autoCloseTimer = setTimeout(() => {
    closeMicroActionToastWindow()
  }, 8000)
}

export function closeMicroActionToastWindow(): void {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer)
    autoCloseTimer = null
  }
  if (microActionWindow && !microActionWindow.isDestroyed()) {
    microActionWindow.destroy()
  }
  microActionWindow = null
}

export function getMicroActionToastWindow(): BrowserWindow | null {
  return microActionWindow && !microActionWindow.isDestroyed() ? microActionWindow : null
}
