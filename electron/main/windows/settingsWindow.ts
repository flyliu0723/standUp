import { showMainWindow } from './mainWindow'

/** @deprecated 使用统一主窗口 */
export function showSettingsWindow(): void {
  showMainWindow('settings')
}
