import { useMemo, useState } from 'react'

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

export function WinnerWheel({ entries }) {
  const [winner, setWinner] = useState(null)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)

  const wheelGradient = useMemo(() => {
    if (!entries.length) {
      return 'conic-gradient(#f0f0f0 0deg 360deg)'
    }

    const sliceAngle = 360 / entries.length

    return `conic-gradient(${entries
      .map((entry, index) => {
        const start = index * sliceAngle
        const end = (index + 1) * sliceAngle
        return `${wheelColors[index % wheelColors.length]} ${start}deg ${end}deg`
      })
      .join(', ')})`
  }, [entries])

  const spinWheel = () => {
    if (!entries.length || isSpinning) return

    const winnerIndex = Math.floor(Math.random() * entries.length)
    const sliceAngle = 360 / entries.length
    const landingAngle = 360 - (winnerIndex * sliceAngle + sliceAngle / 2)
    const selectedWinner = entries[winnerIndex]

    setWinner(null)
    setIsSpinning(true)
    setWheelRotation((currentRotation) => {
      const currentAngle = ((currentRotation % 360) + 360) % 360
      const correction = (landingAngle - currentAngle + 360) % 360
      return currentRotation + 1440 + correction
    })

    window.setTimeout(() => {
      setWinner(selectedWinner)
      setIsSpinning(false)
    }, 3600)
  }

  return (
    <section className="winner-screen">
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
            <small>Entries</small>
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
        {winner && <p>{winner.company || winner.role}</p>}
      </div>

      <div className="mobile-eligible-list">
        <h3>Eligible Entries</h3>
        {entries.length ? (
          entries.map((entry) => (
            <div key={entry.id} className="mobile-entry-row">
              <span>{entry.name}</span>
              <small>{entry.company || entry.role}</small>
            </div>
          ))
        ) : (
          <p>No raffle entries yet.</p>
        )}
      </div>
    </section>
  )
}
