import { BrowserWindow, app, screen } from 'electron'
import { join } from 'path'
import { showMainWindow } from './mainWindow'

const PET_SIZE = 88

let petWindow: BrowserWindow | null = null

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
    x: workX + width - PET_SIZE - 24,
    y: workY + height - PET_SIZE - 120
  }
}

export function showDesktopPetWindow(): void {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.showInactive()
    return
  }

  const pos = getBottomRightPosition()

  petWindow = new BrowserWindow({
    width: PET_SIZE,
    height: PET_SIZE,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
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

  petWindow.setAlwaysOnTop(true, 'floating')
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  petWindow.loadURL(getRendererUrl('/desktop-pet'))

  petWindow.once('ready-to-show', () => {
    petWindow?.showInactive()
  })
}

export function hideDesktopPetWindow(): void {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.hide()
  }
}

export function closeDesktopPetWindow(): void {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.destroy()
  }
  petWindow = null
}

export function getDesktopPetWindow(): BrowserWindow | null {
  return petWindow && !petWindow.isDestroyed() ? petWindow : null
}

export function openMainFromPet(): void {
  showMainWindow('dashboard')
}
