import { resolveMapSrc } from '../utils/mapSrc'

function getPreviewSrc(field, src) {
  if (!src) return ''
  if (field === 'mapSrc') return resolveMapSrc(src)
  return src
}

export function SettingsImageUploadField({
  label,
  field,
  currentSrc,
  helpText,
  disabled = false,
  className = 'form-field asset-upload-field',
  onUpload,
}) {
  const previewSrc = getPreviewSrc(field, currentSrc)

  return (
    <label className={className}>
      <span>{label}</span>
      {previewSrc ? (
        <img
          className="settings-image-preview"
          src={previewSrc}
          alt={`Current ${label}`}
        />
      ) : (
        <p className="muted settings-image-empty">No image uploaded yet.</p>
      )}
      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onUpload(file)
        }}
      />
      <small>{helpText}</small>
    </label>
  )
}
