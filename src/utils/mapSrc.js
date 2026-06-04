export const PLACEHOLDER_MAP_SRC = '/maps/placeholder_map.svg'
export const DEFAULT_MAP_SRC = '/maps/asla_map.PNG'

const MAX_INLINE_MAP_DATA_URL_LENGTH = 600_000

export function resolveMapSrc(mapSrc) {
  const value = typeof mapSrc === 'string' ? mapSrc.trim() : ''

  if (!value) return PLACEHOLDER_MAP_SRC

  if (value.startsWith('data:') && value.length > MAX_INLINE_MAP_DATA_URL_LENGTH) {
    return PLACEHOLDER_MAP_SRC
  }

  return value
}

export function withMapCacheBust(mapSrc, version = '') {
  const resolved = resolveMapSrc(mapSrc)
  if (resolved.startsWith('data:')) return resolved

  const token = String(version || '').trim()
  if (!token) return resolved

  const separator = resolved.includes('?') ? '&' : '?'
  return `${resolved}${separator}v=${encodeURIComponent(token)}`
}
