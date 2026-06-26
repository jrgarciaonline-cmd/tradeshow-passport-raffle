const LEAD_INFO_URL =
  process.env.EXPERIENT_LEAD_INFO_URL ||
  'https://developer.experientswap.com/APIv1/LeadInfo'

export function isExperientConfigured() {
  return Boolean(process.env.EXPERIENT_API_KEY?.trim())
}

export function getExperientApiKey() {
  const apiKey = String(process.env.EXPERIENT_API_KEY ?? '').trim()

  if (!apiKey) {
    throw new Error('EXPERIENT_API_KEY is not configured.')
  }

  return apiKey
}

export async function fetchLeadInfoByBarcode({ apiKey, actCode, badgeId, barcode }) {
  const params = new URLSearchParams({
    apikey: apiKey,
    actcode: actCode,
    badgeid: badgeId,
    barcode,
  })

  const response = await fetch(`${LEAD_INFO_URL}?${params.toString()}`)
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      payload?.Messages?.[0] ||
      payload?.message ||
      'Unable to look up badge information.'
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return payload
}

export function normalizeLeadInfoResult(result) {
  const lead = result?.LeadInfo ?? {}
  const firstName = String(lead.FirstName ?? '').trim()
  const lastName = String(lead.LastName ?? '').trim()
  const name = [firstName, lastName].filter(Boolean).join(' ').trim()

  return {
    success: Boolean(result?.Success),
    messages: Array.isArray(result?.Messages) ? result.Messages : [],
    lead: {
      firstName,
      lastName,
      name,
      email: String(lead.Email ?? '').trim(),
      phone: String(lead.Phone ?? '').trim(),
      company: String(lead.Company ?? '').trim(),
      title: String(lead.Title ?? '').trim(),
      registrantId: String(lead.RegistrantID ?? lead.ConnectKey ?? '').trim(),
    },
  }
}
