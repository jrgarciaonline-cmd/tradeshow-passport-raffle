function normalizeUrl(url) {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export function BoothCard({ booth, completed, highlighted, onShowOnMap }) {
  const websiteUrl = normalizeUrl(booth.websiteUrl)

  return (
    <article className={`booth-card ${completed ? 'is-complete' : ''} ${highlighted ? 'highlighted' : ''}`}>
      <div>
        <h3>
          {booth.name} <span>{booth.location.replace(' / ', ' ')}</span>
        </h3>
        <p>{booth.description}</p>
        <div className="booth-meta">
          <span>{completed ? 'Visited' : 'Needs visit'}</span>
          <span>{booth.category}</span>
        </div>

        <div className="booth-actions">
          {websiteUrl ? (
            <a
              className="button-link"
              href={websiteUrl}
              target="_blank"
              rel="noreferrer"
            >
              Visit Manufacturer Web Page
            </a>
          ) : (
            <button type="button" disabled>
              Visit Manufacturer Web Page
            </button>
          )}
          <button
            type="button"
            className="primary"
            onClick={() => onShowOnMap(booth.id)}
          >
            Show on map
          </button>
        </div>
      </div>
      <div className="challenge-icon" style={{ '--logo-bg': booth.color }}>
        {booth.logoDataUrl ? (
          <img src={booth.logoDataUrl} alt={`${booth.name} logo`} />
        ) : (
          <span>{completed ? '✓' : '▦'}</span>
        )}
      </div>
    </article>
  )
}
