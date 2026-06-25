import { resolveApiUrl } from './apiBaseUrl'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const ATTENDEE_AUTH_SESSION_KEY = 'tradeshow-passport-attendee-auth-v1'

export function isAttendeeAuthEnabled() {
  return import.meta.env.VITE_ATTENDEE_MAGIC_LINK === 'true'
}

export function isSupabaseAuthConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

function buildAttendeeRedirectUrl(eventId) {
  const url = new URL(window.location.href)
  url.hash = ''
  url.searchParams.set('attendee_auth', '1')
  if (eventId) url.searchParams.set('event_id', eventId)
  return url.toString()
}

export function readAttendeeAuthSession() {
  try {
    const stored = window.localStorage.getItem(ATTENDEE_AUTH_SESSION_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    if (!parsed?.accessToken) return null
    if (parsed.expiresAt && Date.now() >= parsed.expiresAt) return null
    return parsed
  } catch {
    return null
  }
}

export function writeAttendeeAuthSession(session) {
  if (!session?.accessToken) {
    window.localStorage.removeItem(ATTENDEE_AUTH_SESSION_KEY)
    return
  }

  window.localStorage.setItem(
    ATTENDEE_AUTH_SESSION_KEY,
    JSON.stringify({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken ?? null,
      expiresAt: session.expiresAt ?? null,
    }),
  )
}

export function clearAttendeeAuthSession() {
  window.localStorage.removeItem(ATTENDEE_AUTH_SESSION_KEY)
}

export function parseAuthHashFromUrl() {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) return null

  const params = new URLSearchParams(hash)
  const accessToken = params.get('access_token')
  if (!accessToken) return null

  const expiresIn = Number(params.get('expires_in') || 3600)
  return {
    accessToken,
    refreshToken: params.get('refresh_token'),
    expiresAt: Date.now() + expiresIn * 1000,
    type: params.get('type'),
  }
}

export function clearAuthHashFromUrl() {
  if (!window.location.hash) return
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`,
  )
}

export async function sendAttendeeMagicLink(email, eventId) {
  if (!isAttendeeAuthEnabled() || !isSupabaseAuthConfigured()) {
    return {
      ok: false,
      message: 'Attendee magic link auth is not enabled.',
    }
  }

  const normalizedEmail = String(email ?? '').trim().toLowerCase()
  if (!normalizedEmail.includes('@')) {
    return { ok: false, message: 'A valid email is required.' }
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: normalizedEmail,
        create_user: true,
        data: { role: 'attendee' },
        options: {
          emailRedirectTo: buildAttendeeRedirectUrl(eventId),
        },
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        ok: false,
        message: result.message || result.error_description || 'Unable to send magic link.',
      }
    }

    return {
      ok: true,
      message: 'Check your email for a sign-in link.',
    }
  } catch (error) {
    return {
      ok: false,
      message: error.message || 'Unable to send magic link.',
    }
  }
}

export async function completeAttendeeAuthSession({ eventId, accessToken }) {
  const response = await fetch(resolveApiUrl('/api/passport-write'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'complete_attendee_auth',
      eventId,
    }),
  })

  const result = await response.json().catch(() => ({
    ok: false,
    message: 'Unable to complete attendee sign-in.',
  }))

  if (!response.ok || !result.ok) {
    return {
      ok: false,
      message: result.message || 'Unable to complete attendee sign-in.',
    }
  }

  return result
}

export async function refreshAttendeeSession(refreshToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!response.ok) return null

  const result = await response.json()
  const expiresIn = Number(result.expires_in || 3600)

  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token ?? refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  }
}
