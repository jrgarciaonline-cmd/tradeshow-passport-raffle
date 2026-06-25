import { resolveApiUrl } from './apiBaseUrl'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export function isAttendeeAuthEnabled() {
  return import.meta.env.VITE_ATTENDEE_MAGIC_LINK === 'true'
}

export function isSupabaseAuthConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

export async function sendAttendeeMagicLink(email, redirectTo) {
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
          emailRedirectTo: redirectTo || window.location.origin,
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

export async function exchangeAttendeeSession(accessToken) {
  if (!accessToken) return null

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) return null
  return response.json()
}

export async function linkAttendeeAuthUser({ accessToken, attendeeId, eventId }) {
  if (!isAttendeeAuthEnabled()) return { ok: false }

  const response = await fetch(resolveApiUrl('/api/passport-write'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'link_attendee_auth',
      eventId,
      attendeeId,
    }),
  })

  const result = await response.json().catch(() => ({ ok: false }))
  return result
}
