import { sendJson } from './supabaseAdmin.js'

export const MAX_BODY_BYTES = 10 * 1024

export function enforceBodySize(request, response, maxBytes = MAX_BODY_BYTES) {
  const contentLength = Number(request.headers['content-length'] || 0)

  if (contentLength > maxBytes) {
    sendJson(response, 413, { ok: false, message: 'Request body too large.' })
    return false
  }

  if (request.body !== undefined && request.body !== null) {
    const bodySize = Buffer.byteLength(JSON.stringify(request.body))

    if (bodySize > maxBytes) {
      sendJson(response, 413, { ok: false, message: 'Request body too large.' })
      return false
    }
  }

  return true
}
