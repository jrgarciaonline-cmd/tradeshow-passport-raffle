export function buildStampOutlinePath(
  size = 200,
  teeth = 12,
  toothRatio = 0.52,
  depthRatio = 0.34,
) {
  const step = size / teeth
  const toothWidth = step * toothRatio
  const gap = step - toothWidth
  const depth = step * depthRatio
  let path = 'M 0 0'

  for (let index = 0; index < teeth; index += 1) {
    const slotStart = index * step
    const x0 = slotStart + gap / 2
    const x1 = x0 + toothWidth
    path += ` L ${x0} 0 L ${x0} ${-depth} L ${x1} ${-depth} L ${x1} 0`
  }

  path += ` L ${size} 0`

  for (let index = 0; index < teeth; index += 1) {
    const slotStart = index * step
    const y0 = slotStart + gap / 2
    const y1 = y0 + toothWidth
    path += ` L ${size} ${y0} L ${size + depth} ${y0} L ${size + depth} ${y1} L ${size} ${y1}`
  }

  path += ` L ${size} ${size}`

  for (let index = teeth - 1; index >= 0; index -= 1) {
    const slotStart = index * step
    const x1 = slotStart + step - gap / 2
    const x0 = x1 - toothWidth
    path += ` L ${x1} ${size} L ${x1} ${size + depth} L ${x0} ${size + depth} L ${x0} ${size}`
  }

  path += ` L 0 ${size}`

  for (let index = teeth - 1; index >= 0; index -= 1) {
    const slotStart = index * step
    const y1 = slotStart + step - gap / 2
    const y0 = y1 - toothWidth
    path += ` L 0 ${y1} L ${-depth} ${y1} L ${-depth} ${y0} L 0 ${y0}`
  }

  path += ' Z'
  return path
}

const STAMP_SIZE = 200
const STAMP_TEETH = 12
const STAMP_STEP = STAMP_SIZE / STAMP_TEETH
const STAMP_DEPTH = STAMP_STEP * 0.34
const STAMP_VIEW_SIZE = STAMP_SIZE + STAMP_DEPTH * 2

export const STAMP_OUTLINE_PATH = buildStampOutlinePath(STAMP_SIZE, STAMP_TEETH)
export const STAMP_VIEW_BOX = `${-STAMP_DEPTH} ${-STAMP_DEPTH} ${STAMP_VIEW_SIZE} ${STAMP_VIEW_SIZE}`
