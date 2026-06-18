import { dialog, Notification } from 'electron'
import Store from 'electron-store'
import { isRestDay } from './holidayService'
import { settingsService } from './settingsService'
import { sessionService } from './sessionService'
import { refreshTrayMenu } from '../tray'

interface ScheduleStateSchema {
  date: string
  startPrompted: boolean
  endPrompted: boolean
}

const store = new Store<{ schedule: ScheduleStateSchema }>({
  name: 'standup-schedule',
  defaults: {
    schedule: { date: '', startPrompted: false, endPrompted: false }
  }
})

function todayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseTimeToMs(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0).getTime()
}

function getScheduleState(): ScheduleStateSchema {
  const key = todayKey()
  const saved = store.get('schedule')
  if (saved.date !== key) {
    return { date: key, startPrompted: false, endPrompted: false }
  }
  return saved
}

function saveScheduleState(state: ScheduleStateSchema): void {
  store.set('schedule', state)
}

export class WorkScheduleService {
  private timer: ReturnType<typeof setInterval> | null = null
  private promptInProgress = false
  private autoActionTimer: ReturnType<typeof setTimeout> | null = null

  start(): void {
    this.tick()
    this.timer = setInterval(() => this.tick(), 30_000)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.clearAutoActionTimer()
  }

  /** 获取今日下班时刻时间戳 */
  getWorkEndTimestamp(): number {
    const { workEndTime } = settingsService.getSettings()
    return parseTimeToMs(workEndTime)
  }

  private tick(): void {
    const settings = settingsService.getSettings()
    if (!settings.enableWorkSchedule) {
      return
    }

    if (settings.enableHolidayRest && isRestDay()) {
      return
    }

    const now = Date.now()
    const startAt = parseTimeToMs(settings.workStartTime)
    const endAt = parseTimeToMs(settings.workEndTime)
    const status = sessionService.getStatus()
    const state = getScheduleState()

    if (now >= startAt && !state.startPrompted && status.state === 'offDuty') {
      void this.promptWorkStart()
      return
    }

    if (now >= endAt && !state.endPrompted && status.state !== 'offDuty') {
      void this.promptWorkEnd()
    }
  }

  private clearAutoActionTimer(): void {
    if (this.autoActionTimer) {
      clearTimeout(this.autoActionTimer)
      this.autoActionTimer = null
    }
  }

  private showScheduleNotification(title: string, body: string): void {
    if (!Notification.isSupported()) {
      return
    }
    const notification = new Notification({ title, body, silent: false })
    notification.show()
  }

  private async promptWorkStart(): Promise<void> {
    if (this.promptInProgress) {
      return
    }
    this.promptInProgress = true

    const settings = settingsService.getSettings()
    const graceSec = settings.scheduleGraceSeconds
    const scheduleState = getScheduleState()
    scheduleState.startPrompted = true
    saveScheduleState(scheduleState)

    this.showScheduleNotification(
      'standUp — 上班时间到了',
      `已到 ${settings.workStartTime}，是否开始久坐计时？${graceSec} 秒无回应将自动开始。`
    )

    let resolved = false

    this.autoActionTimer = setTimeout(() => {
      if (resolved) {
        return
      }
      resolved = true
      sessionService.startWork()
      refreshTrayMenu()
      this.showScheduleNotification('standUp — 已自动上班', '已开始今日久坐计时。')
      this.promptInProgress = false
    }, graceSec * 1000)

    try {
      const { response } = await dialog.showMessageBox({
        type: 'question',
        buttons: ['开始上班', '暂不'],
        defaultId: 0,
        cancelId: 1,
        title: 'standUp — 上班提醒',
        message: `已到上班时间（${settings.workStartTime}）`,
        detail: `是否开始久坐计时？${graceSec} 秒内无操作将自动开始。`
      })

      if (resolved) {
        return
      }
      resolved = true
      this.clearAutoActionTimer()

      if (response === 0) {
        sessionService.startWork()
        refreshTrayMenu()
      }
    } finally {
      this.promptInProgress = false
    }
  }

  private async promptWorkEnd(): Promise<void> {
    if (this.promptInProgress) {
      return
    }
    this.promptInProgress = true

    const settings = settingsService.getSettings()
    const graceSec = settings.scheduleGraceSeconds
    const scheduleState = getScheduleState()
    scheduleState.endPrompted = true
    saveScheduleState(scheduleState)

    this.showScheduleNotification(
      'standUp — 下班时间到了',
      `已到 ${settings.workEndTime}，是否结束今日计时？${graceSec} 秒无回应将自动下班。`
    )

    let resolved = false

    this.autoActionTimer = setTimeout(() => {
      if (resolved) {
        return
      }
      resolved = true
      sessionService.endWork()
      refreshTrayMenu()
      this.showScheduleNotification('standUp — 已自动下班', '今日久坐追踪已结束。')
      this.promptInProgress = false
    }, graceSec * 1000)

    try {
      const { response } = await dialog.showMessageBox({
        type: 'question',
        buttons: ['下班', '继续计时'],
        defaultId: 0,
        cancelId: 1,
        title: 'standUp — 下班提醒',
        message: `已到下班时间（${settings.workEndTime}）`,
        detail: `是否结束今日计时？${graceSec} 秒内无操作将自动下班。`
      })

      if (resolved) {
        return
      }
      resolved = true
      this.clearAutoActionTimer()

      if (response === 0) {
        sessionService.endWork()
        refreshTrayMenu()
      }
    } finally {
      this.promptInProgress = false
    }
  }
}

export const workScheduleService = new WorkScheduleService()
