import { createHash } from 'node:crypto'

export function hashEmail(email) {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!normalized) return 'unknown'

  return createHash('sha256').update(normalized).digest('hex').slice(0, 12)
}

export function logAdminAction(action, { email, outcome, detail = '' }) {
  const payload = {
    action,
    emailHash: hashEmail(email),
    outcome,
    at: new Date().toISOString(),
  }

  if (detail) payload.detail = detail

  console.info(JSON.stringify(payload))
}
