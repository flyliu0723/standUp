import { BrowserWindow, app, screen } from 'electron'
import { join } from 'path'

const TOAST_WIDTH = 340
const TOAST_HEIGHT = 168
const MARGIN = 20

let sitDownPromptWindow: BrowserWindow | null = null
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null

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

export function showSitDownPromptWindow(): void {
  if (sitDownPromptWindow && !sitDownPromptWindow.isDestroyed()) {
    sitDownPromptWindow.focus()
    return
  }

  const pos = getBottomRightPosition()

  sitDownPromptWindow = new BrowserWindow({
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
    focusable: true,
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

  sitDownPromptWindow.setAlwaysOnTop(true, 'pop-up-menu')
  sitDownPromptWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  sitDownPromptWindow.loadURL(getRendererUrl('/sit-down-prompt'))

  sitDownPromptWindow.once('ready-to-show', () => {
    if (!sitDownPromptWindow || sitDownPromptWindow.isDestroyed()) {
      return
    }
    const target = getBottomRightPosition()
    sitDownPromptWindow.setBounds({
      x: target.x,
      y: target.y,
      width: TOAST_WIDTH,
      height: TOAST_HEIGHT
    })
    sitDownPromptWindow.showInactive()
  })

  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer)
  }
  autoCloseTimer = setTimeout(() => {
    closeSitDownPromptWindow()
  }, 30_000)
}

export function closeSitDownPromptWindow(): void {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer)
    autoCloseTimer = null
  }
  if (sitDownPromptWindow && !sitDownPromptWindow.isDestroyed()) {
    sitDownPromptWindow.destroy()
  }
  sitDownPromptWindow = null
}

export function isSitDownPromptOpen(): boolean {
  return Boolean(sitDownPromptWindow && !sitDownPromptWindow.isDestroyed())
}
