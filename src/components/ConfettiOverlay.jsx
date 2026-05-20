const confettiPieces = Array.from({ length: 42 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 9) * 0.12}s`,
  duration: `${2.4 + (index % 6) * 0.18}s`,
  drift: `${((index % 7) - 3) * 12}px`,
  rotation: `${(index * 29) % 180}deg`,
  color: ['#21a66b', '#f8c23a', '#ec6f2d', '#245c6f', '#111111'][
    index % 5
  ],
}))

export function ConfettiOverlay({ active }) {
  if (!active) return null

  return (
    <div className="confetti-overlay" aria-hidden="true">
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
