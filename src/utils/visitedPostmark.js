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

export function getVisitedPostmarkLayout(boothId) {
  const hash = hashString(String(boothId ?? 'booth'))
  const shape = pick(hash, 0, SHAPES)
  const color = pick(hash, 1, COLORS)

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
