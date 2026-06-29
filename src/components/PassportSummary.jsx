export function PassportSummary({
  completedIds,
  requiredScanCount,
  homeImageSrc,
  onShowInstructions,
}) {
  const completedCount = completedIds.length
  const percent = Math.round(
    requiredScanCount
      ? (Math.min(completedCount, requiredScanCount) / requiredScanCount) * 100
      : 0,
  )

  const progressMessage =
    percent >= 100
      ? 'Passport Complete'
      : percent >= 75
        ? 'Almost There'
        : percent >= 50
          ? 'Halfway Stamped'
          : percent >= 25
            ? 'Keep Exploring'
            : 'Start Collecting'
  const showStampTrail = requiredScanCount > 0 && requiredScanCount <= 15

  return (
    <section className="summary-panel">
      <div className="home-image-frame">
        <img
          key={homeImageSrc || '/home/HOME_IMAGE.png'}
          src={homeImageSrc || '/home/HOME_IMAGE.png'}
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true
          }}
        />
      </div>

      <button
        type="button"
        className="home-action-button"
        onClick={onShowInstructions}
      >
        How to Play
      </button>

      <div
        className={`drawing-card booth-visit-progress${percent >= 100 ? ' is-complete' : ''}`}
        style={{ '--progress': `${percent}%` }}
      >
        <p className="booth-visit-message">{progressMessage}</p>
        <div className="booth-visit-score">
          <strong>{completedCount}</strong>
          <span>/ {requiredScanCount}</span>
        </div>
        <p className="booth-visit-label">Grand Prize Drawing</p>

        <div
          className="booth-visit-track"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={requiredScanCount}
          aria-label={`${completedCount} of ${requiredScanCount} booths visited`}
        >
          <div className="booth-visit-fill" />
          {showStampTrail && (
            <div className="booth-visit-stamps" aria-hidden="true">
              {Array.from({ length: requiredScanCount }, (_, index) => (
                <span
                  key={index}
                  className={`booth-visit-stamp${index < completedCount ? ' is-stamped' : ''}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="drawing-meta">
          <span>Scans remaining: {Math.max(0, requiredScanCount - completedCount)}</span>
          <span>{percent}% · Goal: {requiredScanCount}</span>
        </div>
      </div>
    </section>
  )
}
