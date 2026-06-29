const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const ASSET_BUCKET = 'event-assets'

function isAssetStorageConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

function dataUrlToBlob(dataUrl) {
  const [header, base64 = ''] = dataUrl.split(',')
  const mimeType = header.match(/data:(.*?);/)?.[1] || 'application/octet-stream'
  const bytes = atob(base64)
  const buffer = new Uint8Array(bytes.length)

  for (let index = 0; index < bytes.length; index += 1) {
    buffer[index] = bytes.charCodeAt(index)
  }

  return new Blob([buffer], { type: mimeType })
}

function getExtension(mimeType) {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg'
  if (mimeType.includes('webp')) return 'webp'
  return 'png'
}

function getPublicAssetUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${ASSET_BUCKET}/${path}`
}

export function isRemoteAssetUrl(value) {
  return typeof value === 'string' && /^https?:\/\//.test(value)
}

export function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:')
}

async function uploadBlobToStorage({ path, blob, accessToken }) {
  if (!accessToken) {
    throw new Error(
      'Admin authentication is required for asset uploads. Sign in again and retry.',
    )
  }

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${ASSET_BUCKET}/${path}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': blob.type,
        'x-upsert': 'true',
      },
      body: blob,
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    if (response.status === 403) {
      throw new Error(
        'Storage upload denied. Confirm you are signed in as an authorized admin and that supabase-storage-setup.sql has been applied.',
      )
    }
    throw new Error(detail || `Asset upload failed: ${response.status}`)
  }

  return getPublicAssetUrl(path)
}

export async function uploadEventAsset({ eventId, assetType, dataUrl, accessToken }) {
  if (!isAssetStorageConfigured()) {
    return dataUrl
  }

  const blob = dataUrlToBlob(dataUrl)
  const extension = getExtension(blob.type)
  const path = `${eventId}/${assetType}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`

  return uploadBlobToStorage({ path, blob, accessToken })
}

export async function uploadBoothLogo({ eventId, boothId, dataUrl, accessToken }) {
  if (!isAssetStorageConfigured() || !isDataUrl(dataUrl)) {
    return dataUrl
  }

  const blob = dataUrlToBlob(dataUrl)
  const extension = getExtension(blob.type)
  const safeBoothId = String(boothId || 'booth').replace(/[^a-zA-Z0-9_-]/g, '-')
  const path = `${eventId}/booth-logos/${safeBoothId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`

  return uploadBlobToStorage({ path, blob, accessToken })
}
