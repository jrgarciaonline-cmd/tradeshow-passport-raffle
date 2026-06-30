import { NavIcon } from './NavIcon'
import { RaffleEntryPanel } from './RaffleEntryPanel'
import {
  BUNDLED_HOME_IMAGE_SRC,
  resolveAppAssetUrl,
  resolveHomeImageSrc,
} from '../utils/homeImageSrc'

export function PassportSummary({
  completedIds,
  requiredScanCount,
  homeImageSrc,
  onShowInstructions,
  passportComplete,
  attendee,
  hasEntered,
  latestEntry,
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
  const resolvedHomeImageSrc = resolveHomeImageSrc(homeImageSrc)
  const bundledHomeImageSrc = resolveAppAssetUrl(BUNDLED_HOME_IMAGE_SRC)

  const handleHomeImageError = (event) => {
    if (event.currentTarget.src !== bundledHomeImageSrc) {
      event.currentTarget.src = bundledHomeImageSrc
      return
    }

    event.currentTarget.hidden = true
  }

  return (
    <section className="summary-panel">
      <div className="home-image-frame">
        <img
          key={resolvedHomeImageSrc}
          src={resolvedHomeImageSrc}
          alt=""
          onError={handleHomeImageError}
        />
      </div>

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

      <button
        type="button"
        className="home-action-button"
        onClick={onShowInstructions}
      >
        <NavIcon name="info" size={16} />
        How to Play
      </button>

      {passportComplete && (
        <div className="celebration-panel">
          <div className="burst" aria-hidden="true">
            ✓
          </div>
          <div>
            <p className="eyebrow">Passport Complete</p>
            <h2>Raffle unlocked</h2>
          </div>
        </div>
      )}

      <RaffleEntryPanel
        disabled={!passportComplete}
        attendee={attendee}
        hasEntered={hasEntered}
        latestEntry={latestEntry}
      />
    </section>
  )
}
