/* global process */

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
export const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
export const ADMIN_INVITE_REDIRECT_URL = process.env.ADMIN_INVITE_REDIRECT_URL
export const ADMIN_INVITE_DEEP_LINK_URL = process.env.ADMIN_INVITE_DEEP_LINK_URL
export const SUPABASE_REQUEST_TIMEOUT_MS = 8000

export function sendJson(response, status, body) {
  response.status(status).json(body)
}

function parseSupabaseResponse(text) {
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

export async function requestSupabase(path, token, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: token,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const text = await response.text()
    const data = parseSupabaseResponse(text)

    if (!response.ok) {
      throw new Error(data?.message || data?.error_description || text || response.statusText)
    }

    return data
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'Supabase email service timed out. Try again shortly or configure custom SMTP in Supabase Auth.',
        { cause: error },
      )
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function getAdminUser(email) {
  const rows = await requestSupabase(
    `/rest/v1/admin_users?email=eq.${encodeURIComponent(email)}&select=email,name,role`,
    SUPABASE_SERVICE_ROLE_KEY,
  )

  return rows?.[0] ?? null
}

export function getAdminRedirectUrl(request) {
  if (ADMIN_INVITE_DEEP_LINK_URL) return ADMIN_INVITE_DEEP_LINK_URL
  if (ADMIN_INVITE_REDIRECT_URL) return ADMIN_INVITE_REDIRECT_URL

  const fallbackOrigin = request.headers.origin || `https://${request.headers.host}`
  return `${fallbackOrigin}/admin`
}

export async function sendRecoveryEmail({ email, redirectTo }) {
  return requestSupabase(
    `/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
    SUPABASE_ANON_KEY,
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    },
  )
}

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY)
}
