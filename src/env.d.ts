import type { StandUpApi, MainTab } from '../../electron/preload/index'

declare global {
  interface Window {
    standUp: StandUpApi
  }
}

export type { MainTab }
