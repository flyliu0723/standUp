import { Notification, app } from 'electron'
import { settingsService } from './settingsService'

type NotificationAction = 'stand' | 'snooze'

type ActionHandler = (action: NotificationAction) => void

let actionHandler: ActionHandler | null = null
let currentNotification: Notification | null = null

export function initNotificationService(): void {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.standup.app')
  }
}

export function setNotificationActionHandler(handler: ActionHandler): void {
  actionHandler = handler
}

export function showReminderToast(sitMinutes: number): void {
  closeReminderToast()

  if (!Notification.isSupported()) {
    return
  }

  const snoozeMinutes = settingsService.getSettings().snoozeMinutes
  const notification = new Notification({
    title: 'standUp — 该起立了',
    body: `你已经连续坐了 ${sitMinutes} 分钟，起来活动一下吧。`,
    silent: false,
    actions: [
      { type: 'button', text: '我已起立' },
      { type: 'button', text: `推迟${snoozeMinutes}分钟` }
    ],
    closeButtonText: '关闭'
  })

  notification.on('action', (_event, index) => {
    if (index === 0) {
      actionHandler?.('stand')
    } else if (index === 1) {
      actionHandler?.('snooze')
    }
    closeReminderToast()
  })

  notification.on('click', () => {
    actionHandler?.('stand')
    closeReminderToast()
  })

  notification.on('close', () => {
    if (currentNotification === notification) {
      currentNotification = null
    }
  })

  currentNotification = notification
  notification.show()
}

export function showStandCompleteToast(): void {
  if (!Notification.isSupported()) {
    return
  }
  const notification = new Notification({
    title: 'standUp — 休息结束',
    body: '站立目标已达成，可以回工位坐下了。',
    silent: false
  })
  notification.show()
}

export function closeReminderToast(): void {
  if (currentNotification) {
    currentNotification.close()
    currentNotification = null
  }
}
