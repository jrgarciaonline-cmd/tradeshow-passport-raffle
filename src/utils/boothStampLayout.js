const STAMP_PLACEMENTS = [
  { rotate: 0, x: 0, y: 0 },
  { rotate: -6, x: -2, y: -5 },
  { rotate: 5, x: 3, y: 3 },
  { rotate: -4, x: -1, y: 6 },
  { rotate: 0, x: 0, y: -4 },
  { rotate: 6, x: 2, y: -3 },
  { rotate: -5, x: -3, y: 4 },
  { rotate: 3, x: 1, y: -6 },
  { rotate: -3, x: 2, y: 5 },
  { rotate: 4, x: -2, y: 1 },
  { rotate: 0, x: 0, y: 4 },
  { rotate: -6, x: 1, y: -2 },
  { rotate: 5, x: -3, y: -4 },
  { rotate: -2, x: 2, y: 3 },
]

function hashString(value = '') {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

export function getBoothStampPlacementStyle(boothId = '') {
  const placement = STAMP_PLACEMENTS[hashString(boothId) % STAMP_PLACEMENTS.length]

  return {
    transform: `translate(${placement.x}px, ${placement.y}px) rotate(${placement.rotate}deg)`,
  }
}
