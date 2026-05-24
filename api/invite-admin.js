/* global process */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_INVITE_REDIRECT_URL = process.env.ADMIN_INVITE_REDIRECT_URL
const SUPABASE_REQUEST_TIMEOUT_MS = 8000

function sendJson(response, status, body) {
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

async function requestSupabase(path, token, options = {}) {
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

async function upsertAdminUser({ email, name, role }) {
  await requestSupabase('/rest/v1/admin_users?on_conflict=email', SUPABASE_SERVICE_ROLE_KEY, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ email, name, role }),
  })
}

function getAdminRedirectUrl(request) {
  if (ADMIN_INVITE_REDIRECT_URL) return ADMIN_INVITE_REDIRECT_URL

  const fallbackOrigin = request.headers.origin || `https://${request.headers.host}`
  return `${fallbackOrigin}/admin`
}

async function inviteAuthUser({ email, name, role, redirectTo }) {
  return requestSupabase(
    `/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      method: 'POST',
      body: JSON.stringify({
        email,
        data: { name, role },
      }),
    },
  )
}

async function sendRecoveryEmail({ email, redirectTo }) {
  return requestSupabase(
    `/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
    SUPABASE_ANON_KEY,
    {
      method: 'POST',
      body: JSON.stringify({
        email,
      }),
    },
  )
}

function isExistingUserError(error) {
  return /email_exists|already been registered|already registered/i.test(
    error?.message ?? '',
  )
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
      message: 'Admin invite API is missing Supabase environment variables.',
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
  const name = String(request.body?.name ?? '').trim()
  const role = request.body?.role === 'super_admin' ? 'super_admin' : 'admin'

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
        message: 'Only a super admin can invite admins.',
      })
      return
    }

    const redirectTo = getAdminRedirectUrl(request)
    await upsertAdminUser({ email, name, role })

    try {
      await inviteAuthUser({
        email,
        name,
        role,
        redirectTo,
      })
    } catch (inviteError) {
      if (!isExistingUserError(inviteError)) throw inviteError

      await sendRecoveryEmail({ email, redirectTo })
      sendJson(response, 200, {
        ok: true,
        message: `${email} already has an account. Password setup/reset email sent instead.`,
      })
      return
    }

    sendJson(response, 200, {
      ok: true,
      message: `${email} was invited and authorized as ${role}.`,
    })
  } catch (error) {
    console.warn(error)
    sendJson(response, 500, {
      ok: false,
      message: error.message || 'Unable to invite admin.',
    })
  }
}
