import { isRemoteAssetUrl, uploadEventAsset } from '../services/assetStorage'
import { readOptimizedImageFile } from './imageUpload'

export const SETTINGS_IMAGE_FIELDS = [
  'homeImageSrc',
  'raffleCompleteImageSrc',
  'mapSrc',
]

const UPLOAD_FAILED_MESSAGE =
  'Image upload failed. Check Supabase Storage setup and admin login.'

export async function uploadSettingsImageField({ field, file, eventId, accessToken }) {
  if (!file) {
    return { ok: false, message: 'Choose an image file to upload.' }
  }

  if (!SETTINGS_IMAGE_FIELDS.includes(field)) {
    return { ok: false, message: 'Unsupported settings image type.' }
  }

  const dataUrl = await readOptimizedImageFile(file, {
    maxWidth: field === 'mapSrc' ? 2400 : 1400,
    maxHeight: field === 'mapSrc' ? 2400 : 1400,
    preferJpeg: field === 'mapSrc',
    quality: 0.84,
  })

  try {
    const url = await uploadEventAsset({
      eventId,
      assetType: field,
      dataUrl,
      accessToken,
    })

    if (isRemoteAssetUrl(url)) {
      return { ok: true, url, field }
    }

    return { ok: false, message: UPLOAD_FAILED_MESSAGE }
  } catch (error) {
    console.warn(error)
    return { ok: false, message: UPLOAD_FAILED_MESSAGE }
  }
}
