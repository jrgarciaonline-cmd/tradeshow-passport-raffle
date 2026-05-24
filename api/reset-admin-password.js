/* global process */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_INVITE_REDIRECT_URL = process.env.ADMIN_INVITE_REDIRECT_URL

function sendJson(response, status, body) {
  response.status(status).json(body)
}

async function requestSupabase(path, token, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(data?.message || data?.error_description || text || response.statusText)
  }

  return data
}

async function getRequestingUser(accessToken) {
  return requestSupabase('/auth/v1/user', SUPABASE_ANON_KEY, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

async function getAdminUser(email) {
  const rows = await requestSupabase(
    `/rest/v1/admin_users?email=eq.${encodeURIComponent(email)}&select=email,name,role`,
    SUPABASE_SERVICE_ROLE_KEY,
  )

  return rows?.[0] ?? null
}

function getAdminRedirectUrl(request) {
  if (ADMIN_INVITE_REDIRECT_URL) return ADMIN_INVITE_REDIRECT_URL

  const fallbackOrigin = request.headers.origin || `https://${request.headers.host}`
  return `${fallbackOrigin}/admin`
}

async function sendRecoveryEmail({ email, redirectTo }) {
  return requestSupabase('/auth/v1/recover', SUPABASE_ANON_KEY, {
    method: 'POST',
    body: JSON.stringify({
      email,
      redirect_to: redirectTo,
    }),
  })
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    sendJson(response, 405, { ok: false, message: 'Method not allowed.' })
    return
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    sendJson(response, 500, {
      ok: false,
      message: 'Admin password reset API is missing Supabase environment variables.',
    })
    return
  }

  const authHeader = request.headers.authorization || ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!accessToken) {
    sendJson(response, 401, { ok: false, message: 'Admin session is required.' })
    return
  }

  const email = String(request.body?.email ?? '').trim().toLowerCase()

  if (!email || !email.includes('@')) {
    sendJson(response, 400, { ok: false, message: 'Enter a valid admin email.' })
    return
  }

  try {
    const requestingUser = await getRequestingUser(accessToken)
    const requestingEmail = requestingUser?.email?.toLowerCase()
    const requestingAdmin = requestingEmail
      ? await getAdminUser(requestingEmail)
      : null

    if (requestingAdmin?.role !== 'super_admin') {
      sendJson(response, 403, {
        ok: false,
        message: 'Only a super admin can send password reset links.',
      })
      return
    }

    const targetAdmin = await getAdminUser(email)
    if (!targetAdmin) {
      sendJson(response, 404, {
        ok: false,
        message: 'That email is not authorized as an admin.',
      })
      return
    }

    await sendRecoveryEmail({
      email,
      redirectTo: getAdminRedirectUrl(request),
    })

    sendJson(response, 200, {
      ok: true,
      message: `Password reset email sent to ${email}.`,
    })
  } catch (error) {
    console.warn(error)
    sendJson(response, 500, {
      ok: false,
      message: error.message || 'Unable to send password reset email.',
    })
  }
}
