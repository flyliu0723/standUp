import { BrowserWindow } from 'electron'
import { activityMonitorService } from './activityMonitorService'
import { sessionService } from './sessionService'
import { settingsService } from './settingsService'
import { buildWellnessHudStatus } from './wellnessEngine'
import type { WellnessHudStatus } from '../types/session'

const DEFAULT_HUD: WellnessHudStatus = {
  mode: 'off_duty',
  bodyProgress: 0,
  bodyTier: 'neutral',
  mindLoad: 0,
  mindWaveform: [0, 0, 0, 0, 0, 0, 0, 0],
  actionText: '未上班',
  actionDetail: '点击开始追踪',
  countdownMs: 0,
  windowSwitches5m: 0,
  distinctApps5m: 0,
  clipboardOps5m: 0,
  foregroundLabel: null,
  statusLabel: '未上班',
  workState: 'offDuty'
}

export class WellnessService {
  private timer: ReturnType<typeof setInterval> | null = null
  private lastHud: WellnessHudStatus = { ...DEFAULT_HUD }

  start(): void {
    this.stop()
    this.refresh()
    this.timer = setInterval(() => this.refresh(), 1000)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getHudStatus(): WellnessHudStatus {
    return this.lastHud
  }

  private refresh(): void {
    const settings = settingsService.getSettings()
    if (!settings.enableActivityMonitor) {
      this.lastHud = buildWellnessHudStatus(sessionService.getStatus(), {
        foregroundApp: null,
        foregroundLabel: null,
        windowTitle: null,
        appCategory: 'neutral',
        keyboardPerMinute: 0,
        mousePerMinute: 0,
        mouseRangeWidth: 0,
        mouseRangeHeight: 0,
        windowSwitches10m: 0,
        windowSwitches5m: 0,
        distinctApps5m: 0,
        clipboardOps5m: 0,
        keyboardEvents15s: 0,
        continuousActiveMinutes: 0,
        staticWorkIndex: 0,
        neckRiskLevel: 'low',
        workMsToday: 0,
        entertainmentMsToday: 0,
        socialMsToday: 0,
        microActionCountToday: 0,
        isInputActive: false,
        idleMs: 0
      }, [0, 0, 0, 0, 0, 0, 0, 0])
      this.broadcast(this.lastHud)
      return
    }

    const session = sessionService.getStatus()
    const activity = activityMonitorService.getSnapshot()
    const mindWaveform = activityMonitorService.getMindWaveformBuckets()
    const next = buildWellnessHudStatus(session, activity, mindWaveform)
    this.lastHud = next
    this.broadcast(next)
  }

  private broadcast(hud: WellnessHudStatus): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('wellness:hudChange', hud)
    })
  }
}

export const wellnessService = new WellnessService()
