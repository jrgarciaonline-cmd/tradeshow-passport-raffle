import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_PREFIX = 'PASSPORT-SCAN:v1:'
const TOKEN_PATTERN = /^PASSPORT-SCAN:v1:([^:]+):([^:]+):([A-Za-z0-9_-]+)$/

export function isScanSigningConfigured() {
  return Boolean(process.env.SCAN_SIGNING_SECRET?.trim())
}

export function isScanSigningRequired() {
  return process.env.SCAN_SIGNING_REQUIRED === 'true' && isScanSigningConfigured()
}

function signPayload(eventId, boothId, secret) {
  return createHmac('sha256', secret)
    .update(`${eventId}:${boothId}`)
    .digest('base64url')
    .slice(0, 22)
}

export function signScanToken({ eventId, boothId }, secret = process.env.SCAN_SIGNING_SECRET) {
  const normalizedEventId = String(eventId ?? '').trim()
  const normalizedBoothId = String(boothId ?? '').trim()
  const signingSecret = String(secret ?? '').trim()

  if (!normalizedEventId || !normalizedBoothId || !signingSecret) {
    throw new Error('eventId, boothId, and signing secret are required.')
  }

  const signature = signPayload(normalizedEventId, normalizedBoothId, signingSecret)
  return `${TOKEN_PREFIX}${normalizedEventId}:${normalizedBoothId}:${signature}`
}

function signaturesMatch(expected, actual) {
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(actual)

  if (expectedBuffer.length !== actualBuffer.length) return false
  return timingSafeEqual(expectedBuffer, actualBuffer)
}

export function verifyScanToken(token, secret = process.env.SCAN_SIGNING_SECRET) {
  const trimmed = String(token ?? '').trim()
  const signingSecret = String(secret ?? '').trim()
  const match = trimmed.match(TOKEN_PATTERN)

  if (!match) {
    return { valid: false, legacy: true, eventId: null, boothId: null }
  }

  if (!signingSecret) {
    return { valid: false, legacy: false, eventId: match[1], boothId: match[2] }
  }

  const [, eventId, boothId, signature] = match
  const expected = signPayload(eventId, boothId, signingSecret)
  const valid = signaturesMatch(expected, signature)

  return { valid, legacy: false, eventId, boothId }
}

export function assertValidScanToken(token, { eventId, boothId } = {}) {
  const result = verifyScanToken(token)

  if (result.legacy) {
    if (isScanSigningRequired()) {
      throw new Error('Signed scan token is required.')
    }
    return result
  }

  if (!result.valid) {
    throw new Error('Invalid scan token signature.')
  }

  if (eventId && result.eventId !== eventId) {
    throw new Error('Scan token event does not match.')
  }

  if (boothId && result.boothId !== boothId) {
    throw new Error('Scan token booth does not match.')
  }

  return result
}
