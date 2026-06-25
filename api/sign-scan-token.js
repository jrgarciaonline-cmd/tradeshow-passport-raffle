import { handleCors } from './_lib/cors.js'
import { getRequestingAdmin } from './_lib/passportWrite.js'
import { enforceBodySize } from './_lib/requestBody.js'
import { signScanToken } from './_lib/scanToken.js'
import { isSupabaseConfigured, sendJson } from './_lib/supabaseAdmin.js'

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
      message: 'Sign scan token API is missing Supabase environment variables.',
    })
    return
  }

  if (!enforceBodySize(request, response)) return

  const body = request.body ?? {}
  const eventId = String(body.eventId ?? '').trim()
  const boothId = String(body.boothId ?? '').trim()

  const adminUser = await getRequestingAdmin(getAccessToken(request, body))
  if (!adminUser) {
    sendJson(response, 403, {
      ok: false,
      message: 'Admin authorization is required.',
    })
    return
  }

  if (!eventId || !boothId) {
    sendJson(response, 400, {
      ok: false,
      message: 'eventId and boothId are required.',
    })
    return
  }

  try {
    const token = signScanToken({ eventId, boothId })
    sendJson(response, 200, { ok: true, token })
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      message: error.message || 'Unable to sign scan token.',
    })
  }
}
