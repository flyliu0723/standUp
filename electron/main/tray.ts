import { Menu, Tray, nativeImage, app } from 'electron'
import { join } from 'path'
import { sessionService } from './services/sessionService'
import { showMainWindow } from './windows/mainWindow'
import { createTrayIconWithProgress, loadBaseTrayIcon, getUrgencyLabel } from './utils/trayIcon'
import { STAND_REASON_OPTIONS } from './constants/standReasons'
import type { SessionStatus } from './types/session'

let tray: Tray | null = null
let alertTimer: ReturnType<typeof setInterval> | null = null
let alertTicks = 0

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 60) {
    return `${totalMinutes} 分钟`
  }
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getStatusTooltip(): string {
  const status = sessionService.getStatus()
  const base = 'standUp — 久坐提醒'
  if (status.isPaused && status.pausedUntil) {
    const remain = Math.max(0, status.pausedUntil - Date.now())
    const reasonHint = status.pauseReasonLabel ? `${status.pauseReasonLabel} · ` : ''
    return `${base}\n${reasonHint}已暂停 · 剩余 ${formatDuration(remain)}`
  }
  switch (status.state) {
    case 'offDuty':
      return `${base}\n未上班 · 左键打开主面板\nCtrl+Alt+S 快捷操作`
    case 'sitting': {
      const total = status.sitIntervalMinutes * 60 * 1000
      const ratio = total > 0 ? status.timerRemainingMs / total : 0
      const urgency = getUrgencyLabel(ratio)
      const inactiveHint = status.isInactivePaused ? ' · 输入暂停' : ''
      return `${base}\n久坐中 · ${urgency}${inactiveHint}\n已坐 ${formatDuration(status.currentSitMs)} · 距提醒 ${formatCountdown(status.timerRemainingMs)}`
    }
    case 'standing': {
      const reasonHint = status.standReasonLabel ? `${status.standReasonLabel} · ` : ''
      return `${base}\n${reasonHint}休息中 · 已站 ${formatDuration(status.currentStandMs)}\n距坐下 ${formatCountdown(status.timerRemainingMs)}`
    }
    case 'away':
      return `${base}\n离座中 · 计时已冻结\n已坐 ${formatDuration(status.currentSitMs)}`
    case 'paused':
      return `${base}\n已暂停`
    default:
      return base
  }
}

function buildMenu(): Menu {
  const status = sessionService.getStatus()
  const items: Electron.MenuItemConstructorOptions[] = [
    {
      label: '打开主面板',
      click: () => showMainWindow('dashboard')
    },
    { type: 'separator' }
  ]

  if (status.isPaused) {
    items.push({
      label: '恢复',
      click: () => sessionService.resumeFromPause()
    })
  } else if (status.state === 'sitting' || status.state === 'standing' || status.state === 'away') {
    items.push({
      label: '暂停 1 小时',
      click: () => sessionService.pauseReminder(60)
    })
    items.push({
      label: '暂停到今日下班',
      click: () => sessionService.pauseUntilEndOfDay()
    })
  }

  switch (status.state) {
    case 'offDuty':
      items.push({ label: '上班', click: () => sessionService.startWork() })
      break
    case 'sitting':
      items.push({
        label: '立即起立',
        submenu: STAND_REASON_OPTIONS.map((option) => ({
          label: `${option.emoji} ${option.label}（${option.durationMinutes} 分钟）`,
          click: () => sessionService.standUpWithReason(option.id)
        }))
      })
      break
    case 'standing':
      items.push({
        label: `坐下（已站 ${formatDuration(status.currentStandMs)}）`,
        click: () => sessionService.sitDown()
      })
      items.push({ label: '下班', click: () => sessionService.endWork() })
      break
    case 'away':
      items.push({ label: '离座中（等待确认）', enabled: false })
      break
    case 'paused':
      break
  }

  if (status.state === 'sitting' || status.state === 'away') {
    items.push({
      label: '下班',
      click: () => sessionService.endWork()
    })
  }

  items.push({ type: 'separator' })
  items.push({
    label: '快捷起立/坐下 (Ctrl+Alt+S)',
    click: () => sessionService.toggleSitStand()
  })
  items.push({
    label: '今日报告',
    click: () => showMainWindow('report')
  })
  items.push({
    label: '设置',
    click: () => showMainWindow('settings')
  })
  items.push({
    label: '操作指南',
    click: () => showMainWindow('guide')
  })
  items.push({ type: 'separator' })
  items.push({
    label: '退出',
    click: () => {
      app.isQuitting = true
      app.quit()
    }
  })

  return Menu.buildFromTemplate(items)
}

function updateTrayIcon(status?: SessionStatus): void {
  if (!tray) return
  const s = status ?? sessionService.getStatus()

  if (s.state === 'sitting') {
    const total = s.sitIntervalMinutes * 60 * 1000
    const ratio = total > 0 ? s.timerRemainingMs / total : 0
    const remainMin = Math.max(0, Math.ceil(s.timerRemainingMs / 60_000))
    tray.setImage(createTrayIconWithProgress(ratio, remainMin))
  } else if (s.state === 'standing') {
    const total = s.standTimerTotalMs || s.standIntervalMinutes * 60 * 1000
    const ratio = total > 0 ? s.timerRemainingMs / total : 0
    const remainMin = Math.max(0, Math.ceil(s.timerRemainingMs / 60_000))
    tray.setImage(createTrayIconWithProgress(ratio, remainMin))
  } else {
    tray.setImage(loadBaseTrayIcon())
  }
}

export function playTrayAlert(): void {
  if (!tray) return
  stopTrayAlert()
  alertTicks = 0
  alertTimer = setInterval(() => {
    if (!tray) return
    alertTicks += 1
    const status = sessionService.getStatus()
    const total = status.sitIntervalMinutes * 60 * 1000
    const ratio = total > 0 ? status.timerRemainingMs / total : 0
    const remainMin = Math.max(0, Math.ceil(status.timerRemainingMs / 60_000))
    const alert = alertTicks % 2 === 1
    tray.setImage(createTrayIconWithProgress(ratio, remainMin, alert))
    if (alertTicks >= 6) {
      stopTrayAlert()
      updateTrayIcon(status)
    }
  }, 400)
}

function stopTrayAlert(): void {
  if (alertTimer) {
    clearInterval(alertTimer)
    alertTimer = null
  }
}

export function createTray(): Tray {
  tray = new Tray(loadBaseTrayIcon())
  tray.setToolTip(getStatusTooltip())
  refreshTrayMenu()

  tray.on('click', () => {
    showMainWindow('dashboard')
  })

  sessionService.onStateChange((status) => {
    refreshTrayMenu(status)
  })

  return tray
}

export function refreshTrayMenu(status?: SessionStatus): void {
  if (!tray) {
    return
  }
  tray.setToolTip(getStatusTooltip())
  tray.setContextMenu(buildMenu())
  updateTrayIcon(status)
}

export function getTray(): Tray | null {
  return tray
}
