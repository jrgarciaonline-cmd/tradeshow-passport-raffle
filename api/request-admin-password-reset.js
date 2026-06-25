import { handleCors } from './_lib/cors.js'
import { enforceRateLimit, getClientIp } from './_lib/rateLimit.js'
import {
  getAdminRedirectUrl,
  getAdminUser,
  isSupabaseConfigured,
  sendJson,
  sendRecoveryEmail,
} from './_lib/supabaseAdmin.js'

const RESET_RATE_LIMIT = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
}

const GENERIC_SUCCESS_MESSAGE =
  'If that email is authorized as an admin, a password reset link was sent.'

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
      key: `admin-reset:${clientIp}`,
      ...RESET_RATE_LIMIT,
    })
  ) {
    return
  }

  const email = String(request.body?.email ?? '').trim().toLowerCase()

  if (!email || !email.includes('@')) {
    sendJson(response, 400, { ok: false, message: 'Enter a valid admin email.' })
    return
  }

  try {
    const adminUser = await getAdminUser(email)

    if (adminUser) {
      await sendRecoveryEmail({
        email,
        redirectTo: getAdminRedirectUrl(request),
      })
    }

    sendJson(response, 200, {
      ok: true,
      message: GENERIC_SUCCESS_MESSAGE,
    })
  } catch (error) {
    console.warn(error)
    sendJson(response, 500, {
      ok: false,
      message: 'Unable to send password reset email right now. Try again shortly.',
    })
  }
}
