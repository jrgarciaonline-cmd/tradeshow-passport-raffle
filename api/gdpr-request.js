import { handleCors } from './_lib/cors.js'
import { hashEmail, logAdminAction } from './_lib/auditLog.js'
import { getRequestingAdmin, loadSharedState } from './_lib/passportWrite.js'
import { enforceBodySize } from './_lib/requestBody.js'
import { enforceRateLimit, getClientIp } from './_lib/rateLimit.js'
import { isSupabaseConfigured, requestSupabase, sendJson, SUPABASE_SERVICE_ROLE_KEY } from './_lib/supabaseAdmin.js'

const GDPR_RATE_LIMIT = {
  limit: 10,
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
      message: 'GDPR API is missing Supabase environment variables.',
    })
    return
  }

  if (!enforceBodySize(request, response)) return

  const clientIp = getClientIp(request)
  if (
    !enforceRateLimit(response, {
      key: `gdpr-request:${clientIp}`,
      ...GDPR_RATE_LIMIT,
    })
  ) {
    return
  }

  const body = request.body ?? {}
  const action = String(body.action ?? 'export')
  const eventId = String(body.eventId ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()

  const adminUser = await getRequestingAdmin(getAccessToken(request, body))
  if (!adminUser) {
    sendJson(response, 403, {
      ok: false,
      message: 'Admin authorization is required.',
    })
    return
  }

  if (!eventId || !email) {
    sendJson(response, 400, {
      ok: false,
      message: 'eventId and email are required.',
    })
    return
  }

  try {
    if (action === 'export') {
      const sharedState = await loadSharedState(eventId)
      const attendee = sharedState?.attendees?.find((item) => item.email === email)
      const attendeeId = attendee?.id
      const entry = sharedState?.entries?.find(
        (item) => item.email === email || item.attendeeId === attendeeId,
      )
      const scans = attendeeId ? sharedState?.attendeeProgress?.[attendeeId] ?? [] : []

      logAdminAction('gdpr_export', {
        email: adminUser.email,
        outcome: attendee ? 'found' : 'not_found',
        eventId,
        detail: `subject=${hashEmail(email)}`,
      })

      sendJson(response, 200, {
        ok: true,
        data: {
          attendee: attendee ?? null,
          entry: entry ?? null,
          completedBoothIds: scans,
        },
      })
      return
    }

    if (action === 'delete') {
      const sharedState = await loadSharedState(eventId)
      const attendee = sharedState?.attendees?.find((item) => item.email === email)

      if (!attendee) {
        logAdminAction('gdpr_delete', {
          email: adminUser.email,
          outcome: 'not_found',
          eventId,
          detail: `subject=${hashEmail(email)}`,
        })
        sendJson(response, 404, {
          ok: false,
          message: 'No attendee found for that email in this event.',
        })
        return
      }

      const nextState = {
        ...sharedState,
        attendees: sharedState.attendees.filter((item) => item.id !== attendee.id),
        entries: sharedState.entries.filter(
          (item) => item.email !== email && item.attendeeId !== attendee.id,
        ),
        attendeeProgress: Object.fromEntries(
          Object.entries(sharedState.attendeeProgress ?? {}).filter(
            ([id]) => id !== attendee.id,
          ),
        ),
        attendeeLocation: Object.fromEntries(
          Object.entries(sharedState.attendeeLocation ?? {}).filter(
            ([id]) => id !== attendee.id,
          ),
        ),
      }

      await requestSupabase(
        `/rest/v1/passport_state?on_conflict=id`,
        SUPABASE_SERVICE_ROLE_KEY,
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            id: `event:${eventId}`,
            data: nextState,
            updated_at: new Date().toISOString(),
          }),
        },
      )

      await requestSupabase(
        `/rest/v1/attendees?id=eq.${encodeURIComponent(attendee.id)}`,
        SUPABASE_SERVICE_ROLE_KEY,
        { method: 'DELETE' },
      ).catch(() => {})

      logAdminAction('gdpr_delete', {
        email: adminUser.email,
        outcome: 'deleted',
        eventId,
        detail: `subject=${hashEmail(email)}`,
      })

      sendJson(response, 200, { ok: true, message: 'Attendee data removed.' })
      return
    }

    sendJson(response, 400, { ok: false, message: 'Unsupported action.' })
  } catch (error) {
    console.warn(error)
    sendJson(response, error.status || 500, {
      ok: false,
      message: error.message || 'GDPR request failed.',
    })
  }
}
