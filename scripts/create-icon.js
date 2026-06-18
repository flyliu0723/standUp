const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')

const resourcesDir = path.join(__dirname, '..', 'resources')
const pngPath = path.join(resourcesDir, 'icon.png')
const icoPath = path.join(resourcesDir, 'icon.ico')

if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true })
}

const COLORS = {
  borderLeft: [233, 30, 99],
  borderRight: [255, 152, 0],
  white: [255, 255, 255],
  sitting: [158, 158, 158],
  standing: [244, 67, 54],
  chartBlue: [33, 150, 243],
  chartGreen: [76, 175, 80],
  chartOrange: [255, 152, 0],
  ripple: [255, 224, 178],
  textGray: [158, 158, 158],
  textBlack: [26, 26, 26]
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function lerpColor(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t))
  ]
}

function blendPixel(data, width, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= width || y >= width) return
  const idx = (width * y + x) << 2
  const srcA = alpha / 255
  const dstA = data[idx + 3] / 255
  const outA = srcA + dstA * (1 - srcA)
  if (outA <= 0) return
  data[idx] = Math.round((color[0] * srcA + data[idx] * dstA * (1 - srcA)) / outA)
  data[idx + 1] = Math.round((color[1] * srcA + data[idx + 1] * dstA * (1 - srcA)) / outA)
  data[idx + 2] = Math.round((color[2] * srcA + data[idx + 2] * dstA * (1 - srcA)) / outA)
  data[idx + 3] = Math.round(outA * 255)
}

function fillRect(png, x0, y0, w, h, color, alpha = 255) {
  const x1 = Math.floor(x0 + w)
  const y1 = Math.floor(y0 + h)
  for (let y = Math.floor(y0); y < y1; y++) {
    for (let x = Math.floor(x0); x < x1; x++) {
      blendPixel(png.data, png.width, x, y, color, alpha)
    }
  }
}

function fillCircle(png, cx, cy, radius, color, alpha = 255) {
  const r2 = radius * radius
  const minX = Math.floor(cx - radius)
  const maxX = Math.ceil(cx + radius)
  const minY = Math.floor(cy - radius)
  const maxY = Math.ceil(cy + radius)
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r2) {
        blendPixel(png.data, png.width, x, y, color, alpha)
      }
    }
  }
}

function fillPolygon(png, points, color, alpha = 255) {
  if (points.length < 3) return
  let minY = Infinity
  let maxY = -Infinity
  for (const [, y] of points) {
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const intersections = []
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i]
      const [x2, y2] = points[(i + 1) % points.length]
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const x = x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)
        intersections.push(x)
      }
    }
    intersections.sort((a, b) => a - b)
    for (let i = 0; i < intersections.length; i += 2) {
      const xStart = Math.ceil(intersections[i])
      const xEnd = Math.floor(intersections[i + 1])
      for (let x = xStart; x <= xEnd; x++) {
        blendPixel(png.data, png.width, x, y, color, alpha)
      }
    }
  }
}

function roundedRectDistance(x, y, w, h, r) {
  const rx = Math.max(0, Math.min(r, w / 2))
  const ry = Math.max(0, Math.min(r, h / 2))
  const px = Math.max(rx - x, 0, x - (w - rx))
  const py = Math.max(ry - y, 0, y - (h - ry))
  return Math.hypot(px, py)
}

function fillRoundedRect(png, x, y, w, h, radius, color, alpha = 255) {
  const x1 = Math.floor(x)
  const y1 = Math.floor(y)
  const x2 = Math.ceil(x + w)
  const y2 = Math.ceil(y + h)
  for (let py = y1; py < y2; py++) {
    for (let px = x1; px < x2; px++) {
      if (roundedRectDistance(px - x, py - y, w, h, radius) <= 0) {
        blendPixel(png.data, png.width, px, py, color, alpha)
      }
    }
  }
}

function strokeRoundedRectGradient(png, x, y, w, h, radius, thickness, colorLeft, colorRight) {
  const x1 = Math.floor(x - thickness)
  const y1 = Math.floor(y - thickness)
  const x2 = Math.ceil(x + w + thickness)
  const y2 = Math.ceil(y + h + thickness)
  for (let py = y1; py < y2; py++) {
    for (let px = x1; px < x2; px++) {
      const outer = roundedRectDistance(px - x, py - y, w, h, radius)
      const inner = roundedRectDistance(px - x, py - y, w, h, Math.max(0, radius - thickness))
      if (outer <= thickness && inner > 0) {
        const t = (px - x) / w
        const color = lerpColor(colorLeft, colorRight, Math.max(0, Math.min(1, t)))
        blendPixel(png.data, png.width, px, py, color, 255)
      }
    }
  }
}

function drawGlyph(png, glyph, x, y, cell, color, alpha = 255) {
  for (let row = 0; row < glyph.length; row++) {
    const line = glyph[row]
    for (let col = 0; col < line.length; col++) {
      if (line[col] === '1') {
        fillRect(png, x + col * cell, y + row * cell, cell, cell, color, alpha)
      }
    }
  }
}

const FONT = {
  s: ['01110', '10001', '10000', '01110', '10001', '10001', '01110'],
  t: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  a: ['00110', '01001', '01001', '01111', '10001', '10001', '01111'],
  n: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  d: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10001', '10001', '10001'],
  p: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110']
}

function drawText(png, text, x, y, cell, color, alpha = 255) {
  let cursor = x
  for (const ch of text) {
    const glyph = FONT[ch] || FONT[ch.toLowerCase()]
    if (glyph) {
      drawGlyph(png, glyph, cursor, y, cell, color, alpha)
      cursor += glyph[0].length * cell + cell
    }
  }
}

function drawSittingFigure(png, size) {
  const s = size / 256
  const color = COLORS.sitting
  fillRect(png, 52 * s, 118 * s, 34 * s, 6 * s, color)
  fillRect(png, 48 * s, 124 * s, 8 * s, 28 * s, color)
  fillRect(png, 82 * s, 124 * s, 8 * s, 28 * s, color)
  fillRect(png, 56 * s, 100 * s, 26 * s, 22 * s, color)
  fillCircle(png, 69 * s, 90 * s, 10 * s, color)
  fillRect(png, 82 * s, 108 * s, 18 * s, 6 * s, color)
}

function drawStandingFigure(png, size) {
  const s = size / 256
  const color = COLORS.standing
  fillRect(png, 112 * s, 142 * s, 8 * s, 24 * s, color)
  fillRect(png, 128 * s, 142 * s, 8 * s, 24 * s, color)
  fillRect(png, 114 * s, 104 * s, 20 * s, 38 * s, color)
  fillCircle(png, 124 * s, 92 * s, 11 * s, color)
  fillRect(png, 132 * s, 82 * s, 8 * s, 34 * s, color)
  fillRect(png, 136 * s, 78 * s, 16 * s, 8 * s, color)
}

function drawChart(png, size) {
  const s = size / 256
  fillCircle(png, 196 * s, 108 * s, 24 * s, COLORS.ripple, 90)
  fillCircle(png, 196 * s, 108 * s, 16 * s, COLORS.ripple, 110)
  fillRect(png, 176 * s, 126 * s, 12 * s, 22 * s, COLORS.chartBlue)
  fillRect(png, 192 * s, 116 * s, 12 * s, 32 * s, COLORS.chartGreen)
  fillRect(png, 208 * s, 104 * s, 12 * s, 44 * s, COLORS.chartOrange)
}

function createPngBuffer(size) {
  const png = new PNG({ width: size, height: size })
  const border = Math.max(3, Math.round(size * 0.065))
  const radius = Math.round(size * 0.2)
  const pad = Math.max(1, Math.round(size * 0.01))

  strokeRoundedRectGradient(
    png,
    pad,
    pad,
    size - pad * 2,
    size - pad * 2,
    radius,
    border,
    COLORS.borderLeft,
    COLORS.borderRight
  )

  fillRoundedRect(
    png,
    pad + border,
    pad + border,
    size - (pad + border) * 2,
    size - (pad + border) * 2,
    Math.max(0, radius - border * 0.6),
    COLORS.white
  )

  if (size >= 48) {
    drawSittingFigure(png, size)
    drawStandingFigure(png, size)
    drawChart(png, size)
  } else {
    fillRect(png, size * 0.28, size * 0.36, size * 0.12, size * 0.28, COLORS.sitting)
    fillRect(png, size * 0.44, size * 0.28, size * 0.14, size * 0.36, COLORS.standing)
    fillRect(png, size * 0.66, size * 0.5, size * 0.06, size * 0.14, COLORS.chartBlue)
    fillRect(png, size * 0.74, size * 0.42, size * 0.06, size * 0.22, COLORS.chartGreen)
  }

  if (size >= 128) {
    const reportsCell = Math.max(1, Math.round(size / 64))
    const reportsText = 'REPORTS'
    const reportsWidth = reportsText.length * 5 * reportsCell + (reportsText.length - 1) * reportsCell
    drawText(
      png,
      reportsText,
      176 * (size / 256) - reportsWidth / 2 + 12 * (size / 256),
      size * 0.6,
      reportsCell,
      COLORS.textGray
    )
  }

  if (size >= 64) {
    const brandCell = Math.max(1, Math.round(size / 36))
    const brandText = 'standUp'
    const brandWidth = brandText.length * 5 * brandCell + (brandText.length - 1) * brandCell
    drawText(png, brandText, (size - brandWidth) / 2, size * 0.8, brandCell, COLORS.textBlack)
  }

  return PNG.sync.write(png)
}

/** 将多尺寸 PNG 嵌入 ICO（Vista+ 支持 PNG 载荷） */
function pngBuffersToIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)

  let offset = 6 + entries.length * 16
  const parts = [header]

  for (const { size, buffer } of entries) {
    const entry = Buffer.alloc(16)
    entry[0] = size >= 256 ? 0 : size
    entry[1] = size >= 256 ? 0 : size
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(buffer.length, 8)
    entry.writeUInt32LE(offset, 12)
    parts.push(entry)
    offset += buffer.length
  }

  for (const { buffer } of entries) {
    parts.push(buffer)
  }

  return Buffer.concat(parts)
}

const sizes = [16, 32, 48, 64, 128, 256]
const entries = sizes.map((size) => ({ size, buffer: createPngBuffer(size) }))
fs.writeFileSync(pngPath, entries[entries.length - 1].buffer)
fs.writeFileSync(icoPath, pngBuffersToIco(entries))
console.log('Created resources/icon.png and resources/icon.ico')
