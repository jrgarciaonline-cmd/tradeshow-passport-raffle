import { createHash } from 'node:crypto'
import { requestSupabase, SUPABASE_SERVICE_ROLE_KEY } from './supabaseAdmin.js'

export function hashEmail(email) {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!normalized) return 'unknown'

  return createHash('sha256').update(normalized).digest('hex').slice(0, 12)
}

export function logAdminAction(action, { email, outcome, detail = '', eventId = null }) {
  const payload = {
    action,
    emailHash: hashEmail(email),
    outcome,
    at: new Date().toISOString(),
  }

  if (detail) payload.detail = detail
  if (eventId) payload.eventId = eventId

  console.info(JSON.stringify(payload))

  if (process.env.AUDIT_LOG_TO_DB !== 'true') return

  requestSupabase('/rest/v1/admin_audit_log', SUPABASE_SERVICE_ROLE_KEY, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      event_id: eventId,
      admin_email_hash: payload.emailHash,
      action,
      detail: {
        outcome,
        ...(detail ? { message: detail } : {}),
      },
    }),
  }).catch((error) => {
    console.warn('Failed to persist audit log row:', error.message)
  })
}
