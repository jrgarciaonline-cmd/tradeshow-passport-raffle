import { NavIcon } from './NavIcon'
import { getBoothLogoFrameStyle } from '../utils/boothLogoStyles'
import { STAMP_OUTLINE_PATH, STAMP_VIEW_BOX } from '../utils/stampShape'
import { getVisitedPostmarkLayout } from '../utils/visitedPostmark'

function normalizeUrl(url) {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function formatBoothLocation(location) {
  const match = String(location ?? '').match(/\d[\dA-Za-z-]*/)
  return match?.[0] ?? location
}

export function BoothCard({ booth, completed, highlighted, onShowOnMap }) {
  const websiteUrl = normalizeUrl(booth.websiteUrl)
  const boothLabel = formatBoothLocation(booth.location)
  const visitedPostmark = completed
    ? getVisitedPostmarkLayout(booth.id, booth.logoBackgroundColor || '#ffffff')
    : null

  return (
    <article
      className={`booth-stamp ${completed ? 'is-complete' : ''} ${highlighted ? 'highlighted' : ''}`}
    >
      <div className="booth-stamp__art">
        <svg
          className="booth-stamp__shape"
          viewBox={STAMP_VIEW_BOX}
          aria-hidden="true"
          focusable="false"
        >
          <path d={STAMP_OUTLINE_PATH} />
        </svg>
        <div className="booth-stamp__perforation">
          <div className="booth-stamp__face">
            <div className="booth-stamp__frame">
              <div className="booth-stamp__logo" style={getBoothLogoFrameStyle(booth)}>
                {booth.logoDataUrl ? (
                  <img src={booth.logoDataUrl} alt="" />
                ) : (
                  <span aria-hidden="true">{completed ? '✓' : booth.name.slice(0, 1)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        {visitedPostmark && (
          <div
            className={visitedPostmark.className}
            style={visitedPostmark.style}
            aria-hidden="true"
          >
            <span>Visited</span>
          </div>
        )}
      </div>

      <div className="booth-stamp__caption">
        <span className="booth-stamp__number">{boothLabel}</span>
        <h3 className="booth-stamp__name">{booth.name}</h3>
      </div>

      <div className="booth-stamp__actions">
        <button
          type="button"
          className="booth-stamp__action booth-stamp__action--icon primary"
          aria-label="Show on map"
          onClick={() => onShowOnMap(booth.id)}
        >
          <NavIcon name="location" size={18} />
        </button>
        {websiteUrl ? (
          <a
            className="booth-stamp__action booth-stamp__action--icon button-link"
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Visit website"
          >
            <NavIcon name="web" size={18} />
          </a>
        ) : (
          <button
            type="button"
            className="booth-stamp__action booth-stamp__action--icon"
            aria-label="Website unavailable"
            disabled
          >
            <NavIcon name="web" size={18} />
          </button>
        )}
      </div>
    </article>
  )
}
