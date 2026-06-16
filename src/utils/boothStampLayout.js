function hashString(value) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

export function getBoothStampArtStyle(boothId) {
  const hash = hashString(String(boothId ?? 'booth'))
  const rotate = ((hash >> 6) % 15) - 7

  return {
    transform: `rotate(${rotate}deg)`,
  }
}
