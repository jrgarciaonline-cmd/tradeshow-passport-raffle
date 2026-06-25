import { handleCors } from './_lib/cors.js'
import { recordScan } from './_lib/passportWrite.js'
import { enforceBodySize } from './_lib/requestBody.js'
import { enforceRateLimit, getClientIp } from './_lib/rateLimit.js'
import { isSupabaseConfigured, sendJson } from './_lib/supabaseAdmin.js'

const SCAN_RATE_LIMIT = {
  limit: 30,
  windowMs: 60 * 1000,
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
      message: 'Record scan API is missing Supabase environment variables.',
    })
    return
  }

  if (!enforceBodySize(request, response)) return

  const clientIp = getClientIp(request)
  if (
    !enforceRateLimit(response, {
      key: `record-scan:${clientIp}`,
      ...SCAN_RATE_LIMIT,
    })
  ) {
    return
  }

  const body = request.body ?? {}
  const eventId = String(body.eventId ?? '').trim()
  const attendeeId = String(body.attendeeId ?? '').trim()
  const boothId = String(body.boothId ?? '').trim()
  const scanToken = String(body.scanToken ?? body.code ?? '').trim()
  const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : null

  if (!eventId || !attendeeId || !boothId || !scanToken) {
    sendJson(response, 400, {
      ok: false,
      message: 'eventId, attendeeId, boothId, and scanToken are required.',
    })
    return
  }

  try {
    const result = await recordScan({
      eventId,
      attendeeId,
      boothId,
      scanToken,
      idempotencyKey,
    })

    sendJson(response, 200, {
      ok: true,
      duplicate: result.duplicate,
      completedIds: result.completedIds,
    })
  } catch (error) {
    console.warn(error)
    sendJson(response, error.status || 400, {
      ok: false,
      message: error.message || 'Unable to record scan.',
    })
  }
}
