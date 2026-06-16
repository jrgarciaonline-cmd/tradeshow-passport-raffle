export function buildStampOutlinePath(size = 200, teeth = 8) {
  const step = size / teeth
  const depth = step / 2
  let path = `M 0 0`

  for (let index = 0; index < teeth; index += 1) {
    const x0 = index * step
    const x1 = x0 + step
    path += ` L ${x0} ${-depth} L ${x1} ${-depth} L ${x1} 0`
  }

  for (let index = 0; index < teeth; index += 1) {
    const y0 = index * step
    const y1 = y0 + step
    path += ` L ${size + depth} ${y0} L ${size + depth} ${y1} L ${size} ${y1}`
  }

  for (let index = teeth - 1; index >= 0; index -= 1) {
    const x0 = index * step
    const x1 = x0 + step
    path += ` L ${x1} ${size + depth} L ${x0} ${size + depth} L ${x0} ${size}`
  }

  for (let index = teeth - 1; index >= 0; index -= 1) {
    const y0 = index * step
    const y1 = y0 + step
    path += ` L ${-depth} ${y1} L ${-depth} ${y0} L 0 ${y0}`
  }

  path += ' Z'
  return path
}

const STAMP_SIZE = 200
const STAMP_TEETH = 8
const STAMP_DEPTH = STAMP_SIZE / STAMP_TEETH / 2
const STAMP_VIEW_SIZE = STAMP_SIZE + STAMP_DEPTH * 2

export const STAMP_OUTLINE_PATH = buildStampOutlinePath(STAMP_SIZE, STAMP_TEETH)
export const STAMP_VIEW_BOX = `${-STAMP_DEPTH} ${-STAMP_DEPTH} ${STAMP_VIEW_SIZE} ${STAMP_VIEW_SIZE}`
