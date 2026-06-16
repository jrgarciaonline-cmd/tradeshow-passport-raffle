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

  return (
    <article
      className={`booth-stamp ${completed ? 'is-complete' : ''} ${highlighted ? 'highlighted' : ''}`}
    >
      <div className="booth-stamp__perforation">
        <div className="booth-stamp__face">
          <span className="booth-stamp__denomination">{boothLabel}</span>
          <div className="booth-stamp__vignette" style={{ '--logo-bg': booth.color }}>
            {booth.logoDataUrl ? (
              <img src={booth.logoDataUrl} alt="" />
            ) : (
              <span aria-hidden="true">{completed ? '✓' : '▦'}</span>
            )}
          </div>
          <h3 className="booth-stamp__name">{booth.name}</h3>
          <p className="booth-stamp__category">{booth.category}</p>
          {completed && (
            <div className="booth-stamp__postmark" aria-hidden="true">
              <span>Visited</span>
            </div>
          )}
        </div>
      </div>

      <div className="booth-stamp__actions">
        <button
          type="button"
          className="booth-stamp__action primary"
          onClick={() => onShowOnMap(booth.id)}
        >
          Show on map
        </button>
        {websiteUrl ? (
          <a
            className="booth-stamp__action button-link"
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
          >
            Website
          </a>
        ) : (
          <button type="button" className="booth-stamp__action" disabled>
            Website
          </button>
        )}
      </div>
    </article>
  )
}
