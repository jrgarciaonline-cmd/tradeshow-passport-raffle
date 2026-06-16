export function buildStampOutlinePath(size = 200, teeth = 11) {
  const step = size / teeth
  const radius = step / 2
  let path = `M ${radius} 0`

  for (let index = 1; index <= teeth; index += 1) {
    path += ` A ${radius} ${radius} 0 0 1 ${index * step} 0`
  }

  for (let index = 1; index <= teeth; index += 1) {
    path += ` A ${radius} ${radius} 0 0 1 ${size} ${index * step}`
  }

  for (let index = teeth - 1; index >= 0; index -= 1) {
    path += ` A ${radius} ${radius} 0 0 1 ${index * step} ${size}`
  }

  for (let index = teeth - 1; index >= 0; index -= 1) {
    path += ` A ${radius} ${radius} 0 0 1 0 ${index * step}`
  }

  path += ' Z'
  return path
}

export const STAMP_OUTLINE_PATH = buildStampOutlinePath(200, 10)
