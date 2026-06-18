import { app } from 'electron'
import Store from 'electron-store'
import { AppSettings, DEFAULT_SETTINGS } from '../types/session'

interface StoreSchema {
  settings: AppSettings
}

const store = new Store<StoreSchema>({
  name: 'standup-settings',
  defaults: {
    settings: DEFAULT_SETTINGS
  }
})

export class SettingsService {
  getSettings(): AppSettings {
    return { ...DEFAULT_SETTINGS, ...store.get('settings') }
  }

  saveSettings(partial: Partial<AppSettings>): AppSettings {
    const next = { ...this.getSettings(), ...partial }
    store.set('settings', next)
    this.applyLaunchAtLogin(next.launchAtLogin)
    return next
  }

  applyLaunchAtLogin(enabled: boolean): void {
    if (!app.isPackaged && enabled) {
      return
    }
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath
    })
  }

  init(): void {
    const settings = this.getSettings()
    if (app.isPackaged) {
      this.applyLaunchAtLogin(settings.launchAtLogin)
    }
  }
}

export const settingsService = new SettingsService()
