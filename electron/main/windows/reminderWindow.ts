import { BrowserWindow, app, shell, WebContents } from 'electron'
import { join } from 'path'

let reminderWindow: BrowserWindow | null = null
let confirmed = false

export type ReminderPhase = 'alert' | 'standing'

function getRendererUrl(hash: string): string {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}#${hash}`
  }
  return `file://${join(__dirname, '../renderer/index.html')}#${hash}`
}

function isReminderUrl(url: string): boolean {
  return url.includes('/reminder') || url.includes('#/reminder')
}

function findReminderWindows(): BrowserWindow[] {
  const wins: BrowserWindow[] = []
  const seen = new Set<number>()

  if (reminderWindow && !reminderWindow.isDestroyed()) {
    wins.push(reminderWindow)
    seen.add(reminderWindow.id)
  }

  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || seen.has(win.id)) {
      continue
    }
    if (isReminderUrl(win.webContents.getURL())) {
      wins.push(win)
      seen.add(win.id)
    }
  }

  return wins
}

function destroyReminderWindow(win: BrowserWindow): void {
  if (!win || win.isDestroyed()) {
    return
  }
  win.removeAllListeners('close')
  win.destroy()
  if (reminderWindow === win) {
    reminderWindow = null
  }
}

function destroyAllReminderWindows(): void {
  confirmed = true
  for (const win of findReminderWindows()) {
    destroyReminderWindow(win)
  }
  reminderWindow = null
}

export function showReminderWindow(sitMinutes: number, initialPhase: ReminderPhase = 'alert'): void {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    confirmed = false
    reminderWindow.focus()
    sendReminderPhase(initialPhase)
    reminderWindow.webContents.send('reminder:minutes', sitMinutes)
    return
  }

  confirmed = false

  reminderWindow = new BrowserWindow({
    width: 800,
    height: 600,
    fullscreen: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  reminderWindow.setAlwaysOnTop(true, 'screen-saver')
  reminderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  reminderWindow.on('close', (event) => {
    if (!confirmed) {
      event.preventDefault()
    }
  })

  reminderWindow.webContents.on('before-input-event', (event, input) => {
    if (!confirmed && ((input.key === 'F4' && input.alt) || input.key === 'Escape')) {
      event.preventDefault()
    }
  })

  reminderWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  reminderWindow.loadURL(getRendererUrl('/reminder'))

  reminderWindow.once('ready-to-show', () => {
    reminderWindow?.show()
    sendReminderPhase(initialPhase)
    reminderWindow?.webContents.send('reminder:minutes', sitMinutes)
  })
}

export function showReminderStandingPhase(sitMinutes: number): void {
  showReminderWindow(sitMinutes, 'standing')
}

export function sendReminderPhase(phase: ReminderPhase): void {
  const wins = findReminderWindows()
  for (const win of wins) {
    win.webContents.send('reminder:phase', phase)
  }
  if (wins.length > 0) {
    reminderWindow = wins[0]
  }
}

export function closeReminderWindow(): void {
  destroyAllReminderWindows()
}

/** 通过 IPC 发送方定位窗口，避免 dev 热重载后引用丢失 */
export function forceCloseReminderFromSender(sender: WebContents): void {
  confirmed = true
  const senderWin = BrowserWindow.fromWebContents(sender)
  if (senderWin && !senderWin.isDestroyed()) {
    destroyReminderWindow(senderWin)
  }
  destroyAllReminderWindows()
}

export function getReminderWindow(): BrowserWindow | null {
  const wins = findReminderWindows()
  if (wins.length === 0) {
    return null
  }
  reminderWindow = wins[0]
  return wins[0]
}
