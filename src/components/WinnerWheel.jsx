import { useMemo, useState } from 'react'
import { WinnerDancerShow } from './WinnerDancerShow'
import { WinnerConfetti } from './WinnerConfetti'

const wheelColors = [
  '#111111',
  '#21a66b',
  '#f8c23a',
  '#245c6f',
  '#ec6f2d',
  '#6eb34f',
  '#2b8fa3',
  '#757575',
]

export function WinnerWheel({ entries, onWinnerSelected }) {
  const [winner, setWinner] = useState(null)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showEligibleEntries, setShowEligibleEntries] = useState(false)
  const [danceModeIndex, setDanceModeIndex] = useState(0)
  const wheelEntries = useMemo(
    () =>
      entries.flatMap((entry) =>
        Array.from({ length: Math.max(1, Number(entry.chances) || 1) }, () => entry),
      ),
    [entries],
  )

  const wheelGradient = useMemo(() => {
    if (!wheelEntries.length) {
      return 'conic-gradient(#f0f0f0 0deg 360deg)'
    }

    const sliceAngle = 360 / wheelEntries.length

    return `conic-gradient(${wheelEntries
      .map((entry, index) => {
        const start = index * sliceAngle
        const end = (index + 1) * sliceAngle
        return `${wheelColors[index % wheelColors.length]} ${start}deg ${end}deg`
      })
      .join(', ')})`
  }, [wheelEntries])

  const spinWheel = () => {
    if (!wheelEntries.length || isSpinning) return

    const winnerIndex = Math.floor(Math.random() * wheelEntries.length)
    const sliceAngle = 360 / wheelEntries.length
    const landingAngle = 360 - (winnerIndex * sliceAngle + sliceAngle / 2)
    const selectedWinner = wheelEntries[winnerIndex]

    setWinner(null)
    setIsSpinning(true)
    setWheelRotation((currentRotation) => {
      const currentAngle = ((currentRotation % 360) + 360) % 360
      const correction = (landingAngle - currentAngle + 360) % 360
      return currentRotation + 1440 + correction
    })

    window.setTimeout(() => {
      setWinner(selectedWinner)
      onWinnerSelected?.(selectedWinner)
      setIsSpinning(false)
      setDanceModeIndex((currentIndex) => (currentIndex + 1) % 3)
      setShowConfetti(true)
      window.setTimeout(() => {
        setShowConfetti(false)
      }, 4700)
    }, 3600)
  }

  return (
    <section className="winner-screen">
      <WinnerConfetti active={showConfetti} />
      {winner && showConfetti && (
        <div className="winner-reveal-overlay" aria-live="polite">
          <div className="winner-ribbon-banner">
            <span>Winner Selected</span>
            <strong>{winner.name}</strong>
          </div>
          <WinnerDancerShow modeIndex={danceModeIndex} />
        </div>
      )}
      <div className="winner-screen-header">
        <p className="eyebrow">Prize Wheel</p>
        <h2>Pick a Winner</h2>
        <p>Tap the wheel to randomly select from eligible raffle entries.</p>
      </div>

      <button
        type="button"
        className="mobile-wheel-tap-area"
        onClick={spinWheel}
        disabled={!entries.length || isSpinning}
        aria-label="Spin prize wheel"
      >
        <span className="mobile-wheel-pointer" aria-hidden="true" />
        <span
          className="mobile-prize-wheel"
          style={{
            background: wheelGradient,
            transform: `rotate(${wheelRotation}deg)`,
          }}
          aria-hidden="true"
        >
          <span className="mobile-wheel-center">
            <strong>{entries.length}</strong>
            <small>People</small>
          </span>
        </span>
      </button>

      <button
        type="button"
        className="primary spin-wheel-button"
        onClick={spinWheel}
        disabled={!entries.length || isSpinning}
      >
        {isSpinning ? 'Spinning...' : 'Spin Wheel'}
      </button>

      <div className="mobile-winner-result" aria-live="polite">
        <span>{winner ? 'Winner Selected' : 'Ready to draw'}</span>
        <strong>{winner?.name ?? 'No winner yet'}</strong>
      </div>

      <div className="mobile-eligible-list">
        <button
          type="button"
          className="eligible-toggle"
          onClick={() => setShowEligibleEntries((current) => !current)}
        >
          Eligible Entries ({entries.length})
          <span>{showEligibleEntries ? 'Hide' : 'Show'}</span>
        </button>
        {showEligibleEntries && entries.length ? (
          entries.map((entry) => (
            <div key={entry.id} className="mobile-entry-row">
              <span>{entry.name}</span>
              <small>{entry.chances ?? 1}x</small>
            </div>
          ))
        ) : !entries.length ? (
          <p>No raffle entries yet.</p>
        ) : null}
      </div>
    </section>
  )
}
