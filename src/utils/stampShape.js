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

const STAMP_MASK_URL = (() => {
  const path = buildStampOutlinePath()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path fill="black" d="${path}"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
})()

export function getStampMaskStyle() {
  return {
    WebkitMaskImage: STAMP_MASK_URL,
    maskImage: STAMP_MASK_URL,
  }
}
