const winnerConfettiPieces = Array.from({ length: 150 }, (_, index) => ({
  id: index,
  left: `${(index * 29) % 100}%`,
  delay: `${(index % 18) * 0.045}s`,
  duration: `${3 + (index % 8) * 0.18}s`,
  drift: `${((index % 11) - 5) * 18}px`,
  rotation: `${(index * 41) % 220}deg`,
  color: ['#21a66b', '#f8c23a', '#ec6f2d', '#245c6f', '#111111'][
    index % 5
  ],
}))

export function WinnerConfetti({ active }) {
  if (!active) return null

  return (
    <div className="winner-confetti-overlay" aria-hidden="true">
      {winnerConfettiPieces.map((piece) => (
        <span
          key={piece.id}
          className="winner-confetti-piece"
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
