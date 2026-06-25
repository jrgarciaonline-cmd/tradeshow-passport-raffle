const TOKEN_PREFIX = 'PASSPORT-SCAN:v1:'
const TOKEN_PATTERN = /^PASSPORT-SCAN:v1:([^:]+):([^:]+):([A-Za-z0-9_-]+)$/

export function isSignedQrEnabled() {
  return import.meta.env.VITE_SIGNED_QR_CODES === 'true'
}

export function parseScanInput(code) {
  const trimmed = String(code ?? '').trim()
  const match = trimmed.match(TOKEN_PATTERN)

  if (match) {
    return {
      legacy: false,
      eventId: match[1],
      boothId: match[2],
      signature: match[3],
      raw: trimmed,
    }
  }

  return {
    legacy: true,
    eventId: null,
    boothId: null,
    signature: null,
    raw: trimmed,
  }
}

export function formatSignedScanToken({ eventId, boothId, token }) {
  if (token) return token
  if (!eventId || !boothId) return ''
  return `${TOKEN_PREFIX}${eventId}:${boothId}:pending`
}
