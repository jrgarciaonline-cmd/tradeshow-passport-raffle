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

export function getUploadedAssetTimestamp(value) {
  if (typeof value !== 'string') return 0

  const match = value.match(/\/(\d{10,13})-[a-f0-9]{8}\./i)
  return match ? Number(match[1]) : 0
}

export function getMapCacheVersion(mapSrc, remoteUpdatedAt = '') {
  const resolved = resolveMapSrc(mapSrc)
  if (resolved.startsWith('data:')) return ''

  const assetTs = getUploadedAssetTimestamp(resolved)
  if (assetTs) return String(assetTs)

  return String(remoteUpdatedAt || '').trim()
}

export function withMapCacheBust(mapSrc, version = '') {
  const resolved = resolveMapSrc(mapSrc)
  if (resolved.startsWith('data:')) return resolved

  const assetTs = getUploadedAssetTimestamp(resolved)
  if (assetTs) return resolved

  const token = String(version || '').trim()
  if (!token) return resolved

  const withoutVersion = resolved
    .replace(/([?&])v=[^&]*(?=&|$)/g, (_, prefix) => (prefix === '?' ? '?' : ''))
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '')

  const separator = withoutVersion.includes('?') ? '&' : '?'
  return `${withoutVersion}${separator}v=${encodeURIComponent(token)}`
}
