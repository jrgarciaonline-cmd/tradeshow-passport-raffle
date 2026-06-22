export const ADMIN_DEEP_LINK_SCHEME = 'landfxpassport'
export const ADMIN_DEEP_LINK_URL = `${ADMIN_DEEP_LINK_SCHEME}://admin`
export const ADMIN_AUTH_LINK_EVENT = 'admin-auth-link'

const PRODUCTION_HOST = 'tradeshow-passport-raffle.vercel.app'

function normalizeDeepLinkUrl(urlString) {
  return urlString.replace(/^([a-z][a-z0-9+.-]*):\/\//i, 'https://deeplink.local/')
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
    const searchParams = url.searchParams
    const type = hashParams.get('type') || searchParams.get('type')
    const accessToken =
      hashParams.get('access_token') || searchParams.get('access_token')

    if (!accessToken || !['invite', 'recovery'].includes(type)) return null

    const hash = url.hash || `#access_token=${accessToken}&type=${type}`
    return { accessToken, type, hash }
  } catch {
    return null
  }
}

export function getAdminAuthFromLocation(location = window.location) {
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(location.search)
  const type = hashParams.get('type') || searchParams.get('type')
  const accessToken =
    hashParams.get('access_token') || searchParams.get('access_token')

  if (!accessToken || !['invite', 'recovery'].includes(type)) return null
  return { accessToken, type }
}

export function getInviteAccessToken(location = window.location) {
  return getAdminAuthFromLocation(location)?.accessToken ?? ''
}

export function isAdminPath(pathname = window.location.pathname) {
  return pathname.replace(/\/$/, '') === '/admin'
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
