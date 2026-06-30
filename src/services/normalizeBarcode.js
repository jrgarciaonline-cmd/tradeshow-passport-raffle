/**
 * Experient badge QRs encode an L4E URL. iOS BarcodeDetector often returns an
 * uppercase scheme/host (HTTPS://L4E.US/...) while web scanners use lowercase.
 * Experient's LeadInfo API matches the barcode string literally.
 */
export function normalizeBarcodeForLookup(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return trimmed

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  try {
    const url = new URL(trimmed)
    url.protocol = url.protocol.toLowerCase()
    url.hostname = url.hostname.toLowerCase()
    return url.href
  } catch {
    return trimmed
  }
}
