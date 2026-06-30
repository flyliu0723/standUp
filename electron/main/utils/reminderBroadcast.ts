import { BrowserWindow } from 'electron'
import type { ReminderCopy } from '../constants/reminderCopy'
import type { ReminderIdleProgress } from '../types/session'

function isReminderUiUrl(url: string): boolean {
  return (
    url.includes('/reminder') ||
    url.includes('#/reminder') ||
    url.includes('/reminder-toast') ||
    url.includes('#/reminder-toast') ||
    url.includes('/reminder-overlay') ||
    url.includes('#/reminder-overlay') ||
    url.includes('/ide-defer') ||
    url.includes('#/ide-defer')
  )
}

function getReminderWebContents(): Electron.WebContents[] {
  const contents: Electron.WebContents[] = []
  const seen = new Set<number>()

  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || seen.has(win.id)) {
      continue
    }
    const url = win.webContents.getURL()
    if (isReminderUiUrl(url)) {
      contents.push(win.webContents)
      seen.add(win.id)
    }
  }
  return contents
}

export function broadcastReminderCopy(copy: ReminderCopy): void {
  for (const wc of getReminderWebContents()) {
    wc.send('reminder:copy', copy)
  }
}

export function broadcastReminderIdleProgress(progress: ReminderIdleProgress): void {
  for (const wc of getReminderWebContents()) {
    wc.send('reminder:idleProgress', progress)
  }
}
