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
  SUPABASE_SERVICE_ROLE_KEY,
} from './_lib/supabaseAdmin.js'

const INVITE_RATE_LIMIT = {
  limit: 20,
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

async function upsertAdminUser({ email, name, role }) {
  await requestSupabase('/rest/v1/admin_users?on_conflict=email', SUPABASE_SERVICE_ROLE_KEY, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ email, name, role }),
  })
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

function isExistingUserError(error) {
  return /email_exists|already been registered|already registered/i.test(
    error?.message ?? '',
  )
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
      message: 'Admin invite API is missing Supabase environment variables.',
    })
    return
  }

  const clientIp = getClientIp(request)
  if (
    !enforceRateLimit(response, {
      key: `admin-invite:${clientIp}`,
      ...INVITE_RATE_LIMIT,
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
