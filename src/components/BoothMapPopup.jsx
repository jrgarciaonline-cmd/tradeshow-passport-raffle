import { useEffect } from 'react'
import { getBoothLogoFrameStyle } from '../utils/boothLogoStyles'

function normalizeWebsiteUrl(url) {
  const trimmed = String(url ?? '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function BoothMapPopup({ booth, onClose, onScanBooth }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!booth) return null

  const websiteUrl = normalizeWebsiteUrl(booth.websiteUrl)

  return (
    <div
      className="booth-map-popup"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booth-map-popup-title"
    >
      <button
        type="button"
        className="booth-map-popup__backdrop"
        aria-label="Close booth details"
        onClick={onClose}
      />
      <div className="booth-map-popup__card">
        <button
          type="button"
          className="booth-map-popup__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <div className="booth-map-popup__logo" style={getBoothLogoFrameStyle(booth)}>
          {booth.logoDataUrl ? (
            <img src={booth.logoDataUrl} alt="" />
          ) : (
            <span>{booth.name.slice(0, 1)}</span>
          )}
        </div>
        <h3 id="booth-map-popup-title">{booth.name}</h3>
        <div className="booth-map-popup__actions">
          {websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="booth-map-popup__button"
            >
              Visit Website
            </a>
          )}
          <button
            type="button"
            className="booth-map-popup__button"
            onClick={() => {
              onClose?.()
              onScanBooth?.(booth.id)
            }}
          >
            Scan QR Code
          </button>
        </div>
      </div>
    </div>
  )
}
