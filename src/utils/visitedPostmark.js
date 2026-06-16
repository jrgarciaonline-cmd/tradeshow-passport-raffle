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

  const rotate = ((hash >> 10) % 58) - 29
  const top = 10 + ((hash >> 16) % 26)
  const left = 8 + ((hash >> 21) % 30)

  let width = 54 + ((hash >> 26) % 22)
  let height = 50 + ((hash >> 30) % 20)

  if (shape === 'wide') {
    width = Math.max(width, 62)
    height = Math.min(height, 44)
  } else if (shape === 'oval') {
    height = Math.max(height, width - 6)
  } else if (shape === 'circle') {
    const size = Math.max(width, height)
    width = size
    height = size
  }

  return {
    className: `booth-stamp__postmark booth-stamp__postmark--${shape} booth-stamp__postmark--${color}`,
    style: {
      top: `${top}%`,
      left: `${left}%`,
      width: `${width}%`,
      height: `${height}%`,
      transform: `rotate(${rotate}deg)`,
    },
  }
}
