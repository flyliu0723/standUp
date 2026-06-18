import { nativeImage, NativeImage } from 'electron'
import { join } from 'path'
import { app } from 'electron'

const SIZE = 16

function getBaseIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources', 'icon.png')
    : join(__dirname, '../../../resources/icon.png')
}

export function loadBaseTrayIcon(): NativeImage {
  try {
    const img = nativeImage.createFromPath(getBaseIconPath())
    if (!img.isEmpty()) {
      return img.resize({ width: SIZE, height: SIZE })
    }
  } catch {
    // fallback
  }
  return nativeImage.createEmpty()
}

/** 在 16x16 图标上绘制环形进度（0~1 表示剩余比例） */
export function createTrayIconWithProgress(remainingRatio: number, alert = false): NativeImage {
  const base = loadBaseTrayIcon()
  const baseBmp = base.getBitmap()
  const width = base.getSize().width || SIZE
  const height = base.getSize().height || SIZE

  const buffer = Buffer.alloc(width * height * 4)
  if (baseBmp.length >= buffer.length) {
    baseBmp.copy(buffer, 0, 0, buffer.length)
  } else {
    for (let i = 0; i < width * height; i++) {
      buffer[i * 4] = 239
      buffer[i * 4 + 1] = 68
      buffer[i * 4 + 2] = 68
      buffer[i * 4 + 3] = 255
    }
  }

  if (alert) {
    tintBuffer(buffer, width, height, 255, 200, 50, 0.35)
  }

  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) / 2 - 1
  const ratio = Math.max(0, Math.min(1, remainingRatio))
  drawProgressArc(buffer, width, height, cx, cy, radius, ratio)

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
  remainingRatio: number
): void {
  const startAngle = -Math.PI / 2
  const sweep = remainingRatio * Math.PI * 2
  const steps = Math.max(8, Math.floor(remainingRatio * 48))

  for (let s = 0; s <= steps; s++) {
    const angle = startAngle + (sweep * s) / steps
    drawThickPoint(buffer, width, height, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 34, 197, 94, 255)
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
