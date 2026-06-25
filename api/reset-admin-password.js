import { handleCors } from './_lib/cors.js'
import { enforceRateLimit, getClientIp } from './_lib/rateLimit.js'
import {
  getAdminRedirectUrl,
  getAdminUser,
  isSupabaseConfigured,
  requestSupabase,
  sendJson,
  sendRecoveryEmail,
  SUPABASE_ANON_KEY,
} from './_lib/supabaseAdmin.js'

const RESET_RATE_LIMIT = {
  limit: 10,
  windowMs: 15 * 60 * 1000,
}

async function getRequestingUser(accessToken) {
  return requestSupabase('/auth/v1/user', SUPABASE_ANON_KEY, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

export default async function handler(request, response) {
  if (handleCors(request, response)) return

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    sendJson(response, 405, { ok: false, message: 'Method not allowed.' })
    return
  }

  if (!isSupabaseConfigured()) {
    sendJson(response, 500, {
      ok: false,
      message: 'Admin password reset API is missing Supabase environment variables.',
    })
    return
  }

  const clientIp = getClientIp(request)
  if (
    !enforceRateLimit(response, {
      key: `admin-reset-super:${clientIp}`,
      ...RESET_RATE_LIMIT,
    })
  ) {
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
