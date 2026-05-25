const confettiPieces = Array.from({ length: 86 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 14) * 0.08}s`,
  duration: `${2.6 + (index % 7) * 0.16}s`,
  drift: `${((index % 9) - 4) * 13}px`,
  rotation: `${(index * 29) % 180}deg`,
  color: ['#21a66b', '#f8c23a', '#ec6f2d', '#245c6f', '#111111'][
    index % 5
  ],
}))

export function ConfettiOverlay({ active, raffleCompleteImageSrc }) {
  if (!active) return null

  return (
    <div className="confetti-overlay" aria-hidden="true">
      <div className="raffle-complete-card">
        <img
          className="raffle-complete-popup"
          key={raffleCompleteImageSrc || '/home/RAFFLE_COMPLETE.png'}
          src={raffleCompleteImageSrc || '/home/RAFFLE_COMPLETE.png'}
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true
          }}
        />
        <div className="bella-title-card">
          <strong>Bella Farmer</strong>
          <span>Lead Barchitect</span>
        </div>
      </div>
      {confettiPieces.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece"
          style={{
            '--left': piece.left,
            '--delay': piece.delay,
            '--duration': piece.duration,
            '--drift': piece.drift,
            '--rotation': piece.rotation,
            '--color': piece.color,
          }}
        />
      ))}
    </div>
  )
}
