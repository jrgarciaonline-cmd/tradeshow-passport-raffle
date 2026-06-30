import { resolveApiUrl } from './apiBaseUrl'
import { normalizeBarcodeForLookup } from './normalizeBarcode'

export async function lookupBadgeLead({ eventId, signupCode, barcode }) {
  const normalizedBarcode = normalizeBarcodeForLookup(barcode)
  console.log('[badge lookup] request:', {
    eventId,
    signupCode,
    barcode: normalizedBarcode,
    rawBarcode: barcode !== normalizedBarcode ? barcode : undefined,
  })

  const response = await fetch(resolveApiUrl('/api/badge-lookup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, signupCode, barcode: normalizedBarcode }),
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
