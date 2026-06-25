export const ADMIN_DEEP_LINK_SCHEME = 'landfxpassport'
export const ADMIN_DEEP_LINK_URL = `${ADMIN_DEEP_LINK_SCHEME}://admin`
export const ADMIN_AUTH_LINK_EVENT = 'admin-auth-link'

const PRODUCTION_HOST = 'tradeshow-passport-raffle.vercel.app'
const ADMIN_AUTH_TYPES = new Set(['invite', 'recovery', 'magiclink'])

function normalizeDeepLinkUrl(urlString) {
  return urlString.replace(/^([a-z][a-z0-9+.-]*):\/\//i, 'https://deeplink.local/')
}

function readAuthParamsFromSearchParams(searchParams) {
  const type = searchParams.get('type')
  const accessToken = searchParams.get('access_token')

  if (!accessToken || !ADMIN_AUTH_TYPES.has(type)) return null

  return {
    accessToken,
    refreshToken: searchParams.get('refresh_token') || '',
    type,
    expiresIn: Number(searchParams.get('expires_in') || 3600),
  }
}

export function parseAdminAuthFromSearchParams(searchParams) {
  if (!searchParams) return null
  return readAuthParamsFromSearchParams(searchParams)
}

export function parseAdminAuthFromLocation(location = window.location) {
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''))
  const hashAuth = readAuthParamsFromSearchParams(hashParams)
  if (hashAuth) {
    return {
      ...hashAuth,
      hash: location.hash || `#access_token=${hashAuth.accessToken}&type=${hashAuth.type}`,
    }
  }

  const searchAuth = readAuthParamsFromSearchParams(
    new URLSearchParams(location.search),
  )
  if (!searchAuth) return null

  const hash = `#access_token=${searchAuth.accessToken}&type=${searchAuth.type}`
  return { ...searchAuth, hash }
}

export function isAdminDeepLinkUrl(urlString) {
  if (!urlString) return false

  try {
    const url = new URL(normalizeDeepLinkUrl(urlString))
    if (url.hostname === 'admin') return true
    if (url.hostname === PRODUCTION_HOST && url.pathname.replace(/\/$/, '') === '/admin') {
      return true
    }
    return false
  } catch {
    return false
  }
}

export function getAdminAuthFromUrl(urlString) {
  if (!urlString) return null

  try {
    const url = new URL(normalizeDeepLinkUrl(urlString))
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
    const hashAuth = readAuthParamsFromSearchParams(hashParams)
    if (hashAuth) {
      const hash = url.hash || `#access_token=${hashAuth.accessToken}&type=${hashAuth.type}`
      return { ...hashAuth, hash }
    }

    const searchAuth = readAuthParamsFromSearchParams(url.searchParams)
    if (!searchAuth) return null

    const hash = `#access_token=${searchAuth.accessToken}&type=${searchAuth.type}`
    return { ...searchAuth, hash }
  } catch {
    return null
  }
}

export function getAdminAuthFromLocation(location = window.location) {
  return parseAdminAuthFromLocation(location)
}

export function getInviteAccessToken(location = window.location) {
  return getAdminAuthFromLocation(location)?.accessToken ?? ''
}

export function isAdminPath(pathname = window.location.pathname) {
  return pathname.replace(/\/$/, '') === '/admin'
}

export function buildAdminAuthHash(auth) {
  if (!auth?.accessToken || !auth?.type) return ''

  const params = new URLSearchParams({
    access_token: auth.accessToken,
    type: auth.type,
  })

  if (auth.refreshToken) {
    params.set('refresh_token', auth.refreshToken)
  }

  if (auth.expiresIn) {
    params.set('expires_in', String(auth.expiresIn))
  }

  return `#${params.toString()}`
}

export function ensureAdminAuthRoute(location = window.location) {
  if (isAdminPath(location.pathname)) return false

  const auth = parseAdminAuthFromLocation(location)
  if (!auth) return false

  const hash = auth.hash.startsWith('#') ? auth.hash : `#${auth.hash}`
  window.history.replaceState(null, '', `/admin${hash}`)
  window.dispatchEvent(new Event(ADMIN_AUTH_LINK_EVENT))
  return true
}

export function clearAdminAuthHash() {
  if (!isAdminPath(window.location.pathname)) return
  window.history.replaceState(null, '', '/admin')
}

export function applyAdminDeepLink(urlString) {
  if (!isAdminDeepLinkUrl(urlString)) return false

  const auth = getAdminAuthFromUrl(urlString)
  if (!auth) return false

  const hash = auth.hash.startsWith('#') ? auth.hash : `#${auth.hash}`
  window.history.replaceState(null, '', `/admin${hash}`)
  window.dispatchEvent(new Event(ADMIN_AUTH_LINK_EVENT))
  return true
}
