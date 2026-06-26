import { resolveApiUrl } from './apiBaseUrl'

export async function lookupBadgeLead({ eventId, signupCode, barcode }) {
  console.log('[badge lookup] request:', { eventId, signupCode, barcode })

  const response = await fetch(resolveApiUrl('/api/badge-lookup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, signupCode, barcode }),
  })

  const result = await response.json().catch(() => ({
    ok: false,
    message: 'Unable to look up badge information.',
  }))

  console.log('[badge lookup] endpoint response:', result)
  console.log('[badge lookup] email:', result.lead?.email ?? '(none)')

  if (!response.ok || !result.ok) {
    return {
      ok: false,
      message: result.message || 'Unable to look up badge information.',
    }
  }

  return {
    ok: true,
    lead: result.lead,
  }
}
