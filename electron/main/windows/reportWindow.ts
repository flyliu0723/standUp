import { showMainWindow } from './mainWindow'

/** @deprecated 使用统一主窗口 */
export function showReportWindow(): void {
  showMainWindow('report')
}
