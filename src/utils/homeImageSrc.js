export const BUNDLED_HOME_IMAGE_SRC = '/home/HOME_IMAGE.png'

export function resolveAppAssetUrl(src) {
  const value = typeof src === 'string' ? src.trim() : ''
  if (!value) return ''

  if (/^(data:|https?:\/\/)/.test(value)) return value

  if (typeof window === 'undefined') return value

  try {
    return new URL(value, window.location.href).href
  } catch {
    return value
  }
}

export function resolveHomeImageSrc(homeImageSrc) {
  const remote = typeof homeImageSrc === 'string' ? homeImageSrc.trim() : ''
  if (remote) return resolveAppAssetUrl(remote)
  return resolveAppAssetUrl(BUNDLED_HOME_IMAGE_SRC)
}

export function isBundledHomeImageSrc(src) {
  const resolved = resolveAppAssetUrl(typeof src === 'string' ? src.trim() : '')
  const bundled = resolveAppAssetUrl(BUNDLED_HOME_IMAGE_SRC)
  return Boolean(resolved && bundled && resolved === bundled)
}
