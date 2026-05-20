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

export function ConfettiOverlay({ active }) {
  if (!active) return null

  return (
    <div className="confetti-overlay" aria-hidden="true">
      <img
        className="raffle-complete-popup"
        src="/home/RAFFLE_COMPLETE.png"
        alt=""
        onError={(event) => {
          event.currentTarget.hidden = true
        }}
      />
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
