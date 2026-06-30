import { Capacitor } from '@capacitor/core'

const DEFAULT_API_BASE_URL = 'https://tradeshow-passport-raffle.vercel.app'

function isLocalWebHost() {
  if (typeof window === 'undefined') return false
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(window.location.host)
}

function getApiBaseUrl() {
  // Capacitor serves the bundle from capacitor://localhost, which matches
  // isLocalWebHost() but has no /api routes — always use the deployed backend.
  if (Capacitor.isNativePlatform()) {
    const configured = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
    return configured || DEFAULT_API_BASE_URL
  }

  // Local Vite dev/preview serves /api via proxy (or vercel dev on the same host).
  if (isLocalWebHost()) {
    return ''
  }

  const configured = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
  if (configured) return configured

  return ''
}

export function resolveApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = getApiBaseUrl()
  return base ? `${base}${normalizedPath}` : normalizedPath
}
