import { nativeImage, NativeImage, app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

const SIZE = 16

type UrgencyTier = 'safe' | 'warning' | 'danger'

const TIER_COLORS: Record<UrgencyTier, [number, number, number]> = {
  safe: [34, 197, 94],
  warning: [245, 158, 11],
  danger: [239, 68, 68]
}

/** 开发态与生产态统一的图标路径 */
export function getIconPath(filename = 'icon.png'): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources', filename)
  }
  return join(app.getAppPath(), 'resources', filename)
}

/** 图标文件缺失时生成可见的托盘占位图（红底白点） */
function createFallbackTrayIcon(): NativeImage {
  const width = SIZE
  const height = SIZE
  const buffer = Buffer.alloc(width * height * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const dx = x - width / 2
      const dy = y - height / 2
      const inCircle = dx * dx + dy * dy <= (width / 2 - 1) ** 2
      if (inCircle) {
        buffer[i] = 34
        buffer[i + 1] = 197
        buffer[i + 2] = 94
        buffer[i + 3] = 255
      } else {
        buffer[i + 3] = 0
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width, height })
}

export function loadBaseTrayIcon(): NativeImage {
  const iconPath = getIconPath('icon.png')
  if (existsSync(iconPath)) {
    try {
      const img = nativeImage.createFromPath(iconPath)
      if (!img.isEmpty()) {
        return img.resize({ width: SIZE, height: SIZE })
      }
    } catch {
      // fallback below
    }
  }
  return createFallbackTrayIcon()
}

export function loadWindowIcon(): NativeImage | undefined {
  const pngPath = getIconPath('icon.png')
  if (pngPath && existsSync(pngPath)) {
    const img = nativeImage.createFromPath(pngPath)
    if (!img.isEmpty()) return img
  }
  const icoPath = getIconPath('icon.ico')
  if (existsSync(icoPath)) {
    const img = nativeImage.createFromPath(icoPath)
    if (!img.isEmpty()) return img
  }
  return createFallbackTrayIcon()
}

function getUrgencyTier(remainingRatio: number): UrgencyTier {
  if (remainingRatio > 0.25) return 'safe'
  if (remainingRatio > 0.08) return 'warning'
  return 'danger'
}

/** 在 16x16 图标上绘制环形进度与剩余分钟 */
export function createTrayIconWithProgress(
  remainingRatio: number,
  remainingMinutes = 0,
  alert = false
): NativeImage {
  const base = loadBaseTrayIcon()
  const baseBmp = base.getBitmap()
  const width = base.getSize().width || SIZE
  const height = base.getSize().height || SIZE

  const buffer = Buffer.alloc(width * height * 4)
  if (baseBmp.length >= buffer.length) {
    baseBmp.copy(buffer, 0, 0, buffer.length)
  } else {
    for (let i = 0; i < width * height; i++) {
      buffer[i * 4] = 34
      buffer[i * 4 + 1] = 197
      buffer[i * 4 + 2] = 94
      buffer[i * 4 + 3] = 255
    }
  }

  const tier = getUrgencyTier(remainingRatio)
  const [r, g, b] = TIER_COLORS[tier]

  if (alert) {
    tintBuffer(buffer, width, height, 255, 200, 50, 0.4)
  }

  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) / 2 - 1
  const ratio = Math.max(0, Math.min(1, remainingRatio))
  drawProgressArc(buffer, width, height, cx, cy, radius, ratio, r, g, b)

  if (remainingMinutes > 0 && remainingMinutes < 100) {
    drawMinuteLabel(buffer, width, height, remainingMinutes, tier)
  }

  return nativeImage.createFromBuffer(buffer, { width, height })
}

function tintBuffer(
  buffer: Buffer,
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  alpha: number
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (buffer[i + 3] === 0) continue
      buffer[i] = Math.round(buffer[i] * (1 - alpha) + r * alpha)
      buffer[i + 1] = Math.round(buffer[i + 1] * (1 - alpha) + g * alpha)
      buffer[i + 2] = Math.round(buffer[i + 2] * (1 - alpha) + b * alpha)
    }
  }
}

function drawProgressArc(
  buffer: Buffer,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  remainingRatio: number,
  r: number,
  g: number,
  b: number
): void {
  const startAngle = -Math.PI / 2
  const sweep = remainingRatio * Math.PI * 2
  const steps = Math.max(8, Math.floor(remainingRatio * 48))

  for (let s = 0; s <= steps; s++) {
    const angle = startAngle + (sweep * s) / steps
    drawThickPoint(
      buffer,
      width,
      height,
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius,
      r,
      g,
      b,
      255
    )
  }
}

function drawThickPoint(
  buffer: Buffer,
  width: number,
  height: number,
  px: number,
  py: number,
  r: number,
  g: number,
  b: number,
  a: number
): void {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = Math.round(px + dx)
      const y = Math.round(py + dy)
      if (x < 0 || y < 0 || x >= width || y >= height) continue
      const i = (y * width + x) * 4
      buffer[i] = r
      buffer[i + 1] = g
      buffer[i + 2] = b
      buffer[i + 3] = a
    }
  }
}

/** 3x5 像素数字字体，在 16x16 图标中心绘制 1-2 位分钟数 */
const DIGIT_PATTERNS: Record<string, number[][]> = {
  '0': [
    [0, 1, 0],
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [0, 1, 0]
  ],
  '1': [
    [0, 1, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
    [1, 1, 1]
  ],
  '2': [
    [1, 1, 0],
    [0, 0, 1],
    [0, 1, 0],
    [1, 0, 0],
    [1, 1, 1]
  ],
  '3': [
    [1, 1, 0],
    [0, 0, 1],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0]
  ],
  '4': [
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [0, 0, 1]
  ],
  '5': [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 0],
    [0, 0, 1],
    [1, 1, 0]
  ],
  '6': [
    [0, 1, 0],
    [1, 0, 0],
    [1, 1, 0],
    [1, 0, 1],
    [0, 1, 0]
  ],
  '7': [
    [1, 1, 1],
    [0, 0, 1],
    [0, 1, 0],
    [1, 0, 0],
    [1, 0, 0]
  ],
  '8': [
    [0, 1, 0],
    [1, 0, 1],
    [0, 1, 0],
    [1, 0, 1],
    [0, 1, 0]
  ],
  '9': [
    [0, 1, 0],
    [1, 0, 1],
    [0, 1, 1],
    [0, 0, 1],
    [0, 1, 0]
  ]
}

function drawMinuteLabel(
  buffer: Buffer,
  width: number,
  height: number,
  minutes: number,
  tier: UrgencyTier
): void {
  const text = String(Math.min(99, minutes))
  const [r, g, b] = tier === 'danger' ? [255, 255, 255] : [15, 23, 42]
  const digitW = 3
  const digitH = 5
  const gap = 1
  const totalW = text.length * digitW + (text.length - 1) * gap
  let startX = Math.round((width - totalW) / 2)
  const startY = Math.round((height - digitH) / 2)

  for (let d = 0; d < text.length; d++) {
    const pattern = DIGIT_PATTERNS[text[d]]
    if (!pattern) continue
    for (let row = 0; row < digitH; row++) {
      for (let col = 0; col < digitW; col++) {
        if (!pattern[row][col]) continue
        const x = startX + col
        const y = startY + row
        if (x < 0 || y < 0 || x >= width || y >= height) continue
        const i = (y * width + x) * 4
        buffer[i] = r
        buffer[i + 1] = g
        buffer[i + 2] = b
        buffer[i + 3] = 255
      }
    }
    startX += digitW + gap
  }
}

export function getUrgencyLabel(remainingRatio: number): string {
  const tier = getUrgencyTier(remainingRatio)
  if (tier === 'danger') return '即将提醒'
  if (tier === 'warning') return '临近提醒'
  return '正常'
}
