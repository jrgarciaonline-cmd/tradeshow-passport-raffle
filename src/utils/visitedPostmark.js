function hashString(value) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function pick(hash, slot, options) {
  const shift = slot * 5
  return options[(hash >> shift) % options.length]
}

const SHAPES = ['circle', 'oval', 'rounded', 'rect', 'wide']
const COLORS = ['red', 'blue', 'green', 'ink']

const POSTMARK_RGB = {
  red: [205, 58, 58],
  blue: [42, 90, 168],
  green: [36, 118, 72],
  ink: [38, 38, 38],
}

const FAMILY_EXCLUSIONS = {
  red: ['red'],
  blue: ['blue'],
  green: ['green'],
  dark: ['ink'],
  light: [],
  neutral: [],
}

function parseHexColor(value) {
  const hex = value.replace('#', '')
  if (hex.length === 3) {
    return [
      Number.parseInt(hex[0] + hex[0], 16),
      Number.parseInt(hex[1] + hex[1], 16),
      Number.parseInt(hex[2] + hex[2], 16),
    ]
  }

  if (hex.length === 6) {
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ]
  }

  return null
}

function parseColor(color) {
  if (!color) return null

  const value = String(color).trim()
  if (value.startsWith('#')) {
    return parseHexColor(value)
  }

  const rgbMatch = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])]
  }

  return null
}

function getColorFamily(rgb) {
  if (!rgb) return 'neutral'

  const [red, green, blue] = rgb
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2 / 255

  if (lightness > 0.88) return 'light'
  if (lightness < 0.18) return 'dark'

  if (red > green + 40 && red > blue + 40) return 'red'
  if (blue > red + 30 && blue > green + 20) return 'blue'
  if (green > red + 20 && green > blue + 20) return 'green'

  return 'neutral'
}

function colorDistance(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

function pickPostmarkColor(hash, logoBackgroundColor) {
  const background = parseColor(logoBackgroundColor)
  const family = getColorFamily(background)
  const excluded = new Set(FAMILY_EXCLUSIONS[family] ?? [])

  let options = COLORS.filter((color) => !excluded.has(color))

  if (background) {
    options = options.filter((color) => colorDistance(background, POSTMARK_RGB[color]) > 85)
  }

  if (options.length === 0) {
    options = COLORS.filter((color) => color !== 'ink')
  }

  if (options.length === 0) {
    options = ['ink']
  }

  return pick(hash, 1, options)
}

export function getVisitedPostmarkLayout(boothId, logoBackgroundColor = '#ffffff') {
  const hash = hashString(String(boothId ?? 'booth'))
  const shape = pick(hash, 0, SHAPES)
  const color = pickPostmarkColor(hash, logoBackgroundColor)

  let width = 58 + ((hash >> 26) % 16)
  let height = 54 + ((hash >> 30) % 16)

  if (shape === 'wide') {
    width = Math.max(width, 66)
    height = Math.min(height, 46)
  } else if (shape === 'oval') {
    height = Math.max(height, width - 6)
  } else if (shape === 'circle') {
    const size = Math.max(width, height)
    width = size
    height = size
  }

  const rotate = ((hash >> 10) % 46) - 23

  return {
    className: `booth-stamp__postmark booth-stamp__postmark--${shape} booth-stamp__postmark--${color}`,
    style: {
      width: `${width}%`,
      height: `${height}%`,
      transform: `rotate(${rotate}deg)`,
    },
  }
}
