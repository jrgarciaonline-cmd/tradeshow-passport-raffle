import { handleCors } from './_lib/cors.js'
import {
  fetchLeadInfoByBarcode,
  getExperientApiKey,
  normalizeLeadInfoResult,
} from './_lib/experientLeadInfo.js'
import { loadEventIndex } from './_lib/passportWrite.js'
import { enforceBodySize } from './_lib/requestBody.js'
import { enforceRateLimit, getClientIp } from './_lib/rateLimit.js'
import { isSupabaseConfigured, sendJson } from './_lib/supabaseAdmin.js'

const BADGE_LOOKUP_RATE_LIMIT = {
  limit: 30,
  windowMs: 60 * 1000,
}

function normalizeSignupCode(value) {
  return String(value ?? '').trim().toLowerCase()
}

function getEventCredentials(event) {
  return {
    actCode: String(event?.experientActCode ?? '0000000000000000').trim(),
    badgeId: String(event?.experientBadgeId ?? '0').trim() || '0',
  }
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
      message: 'Badge lookup API is missing Supabase environment variables.',
    })
    return
  }

  if (!enforceBodySize(request, response)) return

  const clientIp = getClientIp(request)
  if (
    !enforceRateLimit(response, {
      key: `badge-lookup:${clientIp}`,
      ...BADGE_LOOKUP_RATE_LIMIT,
    })
  ) {
    return
  }

  const body = request.body ?? {}
  const eventId = String(body.eventId ?? '').trim()
  const signupCode = normalizeSignupCode(body.signupCode)
  const barcode = String(body.barcode ?? '').trim()

  if (!eventId || !signupCode || !barcode) {
    sendJson(response, 400, {
      ok: false,
      message: 'eventId, signupCode, and barcode are required.',
    })
    return
  }

  try {
    const events = await loadEventIndex()
    const event = events.find((item) => item.id === eventId)

    if (!event) {
      sendJson(response, 404, { ok: false, message: 'Event not found.' })
      return
    }

    const expectedCode = normalizeSignupCode(event.signupCode)
    if (!expectedCode || signupCode !== expectedCode) {
      sendJson(response, 403, {
        ok: false,
        message: 'Invalid event access code.',
      })
      return
    }

    const { actCode, badgeId } = getEventCredentials(event)
    const result = await fetchLeadInfoByBarcode({
      apiKey: getExperientApiKey(),
      actCode,
      badgeId,
      barcode,
    })

    const normalized = normalizeLeadInfoResult(result)

    if (!normalized.success) {
      sendJson(response, 422, {
        ok: false,
        message:
          normalized.messages[0] ||
          'Badge lookup failed. Try manual sign-in or sign up instead.',
      })
      return
    }

    sendJson(response, 200, {
      ok: true,
      lead: normalized.lead,
    })
  } catch (error) {
    console.warn(error)
    sendJson(response, error.status || 500, {
      ok: false,
      message: error.message || 'Unable to look up badge information.',
    })
  }
}
