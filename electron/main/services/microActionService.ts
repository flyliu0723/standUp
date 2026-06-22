import { Notification } from 'electron'
import { settingsService } from './settingsService'
import { activityMonitorService } from './activityMonitorService'
import { sessionService } from './sessionService'
import {
  showMicroActionToastWindow,
  closeMicroActionToastWindow
} from '../windows/microActionToastWindow'

const MICRO_ACTIONS = [
  { id: 'neck', emoji: '🔄', title: '转一下脖子', body: '左右各转一下，只要 3 秒' },
  { id: 'shoulder', emoji: '💪', title: '耸一下肩', body: '耸肩 → 放松，重复 3 次' },
  { id: 'chest', emoji: '🌬️', title: '扩胸伸展', body: '双手向后扩胸，深呼吸一次' },
  { id: 'eyes', emoji: '👀', title: '远眺放松', body: '看远处 3 秒，让眼睛休息一下' }
]

export class MicroActionService {
  private checkTimer: ReturnType<typeof setInterval> | null = null
  private lastTriggeredAt = 0
  private actionIndex = 0

  start(): void {
    this.stop()
    this.checkTimer = setInterval(() => this.check(), 30_000)
  }

  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
    closeMicroActionToastWindow()
  }

  dismiss(): void {
    closeMicroActionToastWindow()
    activityMonitorService.recordMicroAction()
  }

  getNextAction(): { id: string; emoji: string; title: string; body: string } {
    const action = MICRO_ACTIONS[this.actionIndex % MICRO_ACTIONS.length]
    this.actionIndex += 1
    return action
  }

  private check(): void {
    const settings = settingsService.getSettings()
    if (!settings.enableMicroActionReminders || !settings.enableActivityMonitor) {
      return
    }
    const status = sessionService.getStatus()
    if (status.state !== 'sitting' || status.isPaused) {
      return
    }
    const snapshot = activityMonitorService.getSnapshot()
    if (!snapshot.isInputActive) {
      return
    }
    const intervalMs = settings.microActionIntervalMinutes * 60_000
    const continuousMs = activityMonitorService.getContinuousActiveMinutes() * 60_000
    if (continuousMs < intervalMs) {
      return
    }
    const now = Date.now()
    if (now - this.lastTriggeredAt < intervalMs) {
      return
    }
    if (settings.enableEntertainmentSoftReminder && snapshot.appCategory === 'entertainment') {
      this.showEntertainmentReminder()
      this.lastTriggeredAt = now
      activityMonitorService.recordMicroAction()
      return
    }
    this.triggerMicroAction()
    this.lastTriggeredAt = now
  }

  private triggerMicroAction(): void {
    const action = this.getNextAction()
    showMicroActionToastWindow(action)
  }

  private showEntertainmentReminder(): void {
    if (!Notification.isSupported()) {
      return
    }
    const notification = new Notification({
      title: 'standUp — 休闲提醒',
      body: '检测到娱乐应用使用中，记得偶尔活动一下脖子和肩膀。',
      silent: true
    })
    notification.show()
  }
}

export const microActionService = new MicroActionService()
