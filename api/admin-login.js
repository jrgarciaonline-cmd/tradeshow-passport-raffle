import { handleCors } from './_lib/cors.js'
import { enforceRateLimit, getClientIp } from './_lib/rateLimit.js'
import {
  getAdminUser,
  isSupabaseConfigured,
  requestSupabase,
  sendJson,
  SUPABASE_ANON_KEY,
} from './_lib/supabaseAdmin.js'

const LOGIN_RATE_LIMIT = {
  limit: 10,
  windowMs: 15 * 60 * 1000,
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
      message: 'Admin login API is missing Supabase environment variables.',
    })
    return
  }

  const clientIp = getClientIp(request)
  if (
    !enforceRateLimit(response, {
      key: `admin-login:${clientIp}`,
      ...LOGIN_RATE_LIMIT,
    })
  ) {
    return
  }

  const email = String(request.body?.email ?? request.body?.username ?? '')
    .trim()
    .toLowerCase()
  const password = String(request.body?.password ?? '')

  if (!email || !email.includes('@') || !password) {
    sendJson(response, 400, {
      ok: false,
      message: 'Enter admin email and password.',
    })
    return
  }

  try {
    const authResult = await requestSupabase(
      '/auth/v1/token?grant_type=password',
      SUPABASE_ANON_KEY,
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    )

    const adminUser = await getAdminUser(email)

    if (!adminUser) {
      sendJson(response, 403, {
        ok: false,
        message: 'Invalid admin email or password.',
      })
      return
    }

    sendJson(response, 200, {
      ok: true,
      user: {
        email: adminUser.email,
        name: adminUser.name || adminUser.email,
        role: adminUser.role || 'admin',
      },
      session: {
        accessToken: authResult.access_token,
        refreshToken: authResult.refresh_token,
        expiresAt: Date.now() + Number(authResult.expires_in || 3600) * 1000,
      },
      message: `Admin signed in as ${adminUser.name || adminUser.email}.`,
    })
  } catch (error) {
    console.warn(error)
    sendJson(response, 401, {
      ok: false,
      message: 'Invalid admin email or password.',
    })
  }
}
