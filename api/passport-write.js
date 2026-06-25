import { handleCors } from './_lib/cors.js'
import {
  applyValidatedPatch,
  getRequestingAdmin,
  loadEventIndex,
  loadSharedState,
  saveEventIndex,
  saveSharedState,
} from './_lib/passportWrite.js'
import { enforceBodySize } from './_lib/requestBody.js'
import { enforceRateLimit, getClientIp } from './_lib/rateLimit.js'
import { isSupabaseConfigured, sendJson } from './_lib/supabaseAdmin.js'

const WRITE_RATE_LIMIT = {
  limit: 120,
  windowMs: 60 * 1000,
}

const PUBLIC_WRITE_RATE_LIMIT = {
  limit: 60,
  windowMs: 60 * 1000,
}

function getAccessToken(request, body) {
  const authHeader = request.headers.authorization || ''
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  return headerToken || String(body?.adminAccessToken ?? '')
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
      message: 'Passport write API is missing Supabase environment variables.',
    })
    return
  }

  if (!enforceBodySize(request, response)) return

  const clientIp = getClientIp(request)
  const body = request.body ?? {}
  const action = String(body.action ?? 'patch')

  if (
    !enforceRateLimit(response, {
      key: `passport-write:${clientIp}`,
      ...WRITE_RATE_LIMIT,
    })
  ) {
    return
  }

  try {
    if (action === 'patch') {
      const eventId = String(body.eventId ?? '').trim()
      const patch = body.patch

      if (!eventId || !patch || typeof patch !== 'object') {
        sendJson(response, 400, {
          ok: false,
          message: 'eventId and patch are required.',
        })
        return
      }

      if (
        !enforceRateLimit(response, {
          key: `passport-write-public:${clientIp}`,
          ...PUBLIC_WRITE_RATE_LIMIT,
        })
      ) {
        return
      }

      await applyValidatedPatch({
        eventId,
        patch,
        adminAccessToken: getAccessToken(request, body),
        scanToken: body.scanToken,
        idempotencyKey: body.idempotencyKey,
      })

      sendJson(response, 200, { ok: true })
      return
    }

    const adminAccessToken = getAccessToken(request, body)
    const adminUser = await getRequestingAdmin(adminAccessToken)

    if (!adminUser) {
      sendJson(response, 403, {
        ok: false,
        message: 'Admin authorization is required for this action.',
      })
      return
    }

    if (action === 'replace') {
      const eventId = String(body.eventId ?? '').trim()
      const data = body.data

      if (!eventId || !data || typeof data !== 'object') {
        sendJson(response, 400, {
          ok: false,
          message: 'eventId and data are required.',
        })
        return
      }

      await saveSharedState(eventId, data, { dualWriteFull: true })
      sendJson(response, 200, { ok: true })
      return
    }

    if (action === 'save_events') {
      const events = body.events

      if (!Array.isArray(events)) {
        sendJson(response, 400, {
          ok: false,
          message: 'events must be an array.',
        })
        return
      }

      await saveEventIndex(events)
      sendJson(response, 200, { ok: true })
      return
    }

    if (action === 'load_shared') {
      const eventId = String(body.eventId ?? '').trim()

      if (!eventId) {
        sendJson(response, 400, {
          ok: false,
          message: 'eventId is required.',
        })
        return
      }

      const data = await loadSharedState(eventId)
      sendJson(response, 200, { ok: true, data })
      return
    }

    if (action === 'load_events') {
      const events = await loadEventIndex()
      sendJson(response, 200, { ok: true, events })
      return
    }

    sendJson(response, 400, { ok: false, message: 'Unsupported action.' })
  } catch (error) {
    console.warn(error)
    sendJson(response, error.status || 500, {
      ok: false,
      message: error.message || 'Unable to save passport state.',
    })
  }
}
