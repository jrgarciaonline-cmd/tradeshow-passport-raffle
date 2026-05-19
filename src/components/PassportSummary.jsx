export function PassportSummary({ completedIds, requiredScanCount }) {
  const completedCount = completedIds.length
  const percent = Math.round(
    requiredScanCount
      ? (Math.min(completedCount, requiredScanCount) / requiredScanCount) * 100
      : 0,
  )

  return (
    <section className="summary-panel">
      <img
        className="passport-logo"
        src="/logos/landfx-logo-400w.png"
        alt="Land F/X Passport Raffle"
        onError={(event) => {
          event.currentTarget.hidden = true
        }}
      />
      <h1>Samuel Smith</h1>
      <div className="points-gauge" style={{ '--percent': `${percent * 1.8}deg` }}>
        <div>
          <strong>{completedCount}/{requiredScanCount}</strong>
          <span>Booths Visited</span>
        </div>
      </div>

      <div className="home-image-frame">
        <img
          src="/home/HOLD_IMAGE.PNG"
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true
          }}
        />
      </div>

      <div className="drawing-card">
        <div className="drawing-title">
          <strong>Grand Prize Drawing</strong>
          <span>{percent}%</span>
        </div>
        <div className="progress-track" aria-label={`${percent}% complete`}>
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <div className="drawing-meta">
          <span>Scans remaining: {Math.max(0, requiredScanCount - completedCount)}</span>
          <span>Goal: {requiredScanCount}</span>
        </div>
      </div>
    </section>
  )
}
