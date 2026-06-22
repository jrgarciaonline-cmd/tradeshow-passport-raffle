import { Capacitor } from '@capacitor/core'

const DEFAULT_API_BASE_URL = 'https://tradeshow-passport-raffle.vercel.app'

function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
  if (configured) return configured

  if (Capacitor.isNativePlatform()) {
    return DEFAULT_API_BASE_URL
  }

  return ''
}

export function resolveApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = getApiBaseUrl()
  return base ? `${base}${normalizedPath}` : normalizedPath
}
