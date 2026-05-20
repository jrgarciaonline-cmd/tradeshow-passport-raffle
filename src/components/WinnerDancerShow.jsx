const danceModes = ['solo', 'moonwalk', 'group']

function Dancer({ className = '', style }) {
  return (
    <div className={`winner-dancer ${className}`.trim()} style={style} aria-hidden="true">
      <span className="winner-dancer-head" />
      <span className="winner-dancer-body" />
      <span className="winner-dancer-arm left" />
      <span className="winner-dancer-arm right" />
      <span className="winner-dancer-leg left" />
      <span className="winner-dancer-leg right" />
    </div>
  )
}

export function WinnerDancerShow({ modeIndex }) {
  const mode = danceModes[modeIndex % danceModes.length] ?? 'solo'

  if (mode === 'moonwalk') {
    return (
      <div className="winner-dancer-stage moonwalk" aria-hidden="true">
        <Dancer className="moonwalker" />
      </div>
    )
  }

  if (mode === 'group') {
    return (
      <div className="winner-dancer-stage group" aria-hidden="true">
        {[16, 33, 50, 67, 84].map((left, index) => (
          <Dancer
            key={left}
            style={{
              '--dancer-left': `${left}%`,
              '--dancer-delay': `${index * 0.08}s`,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="winner-dancer-stage solo" aria-hidden="true">
      <Dancer />
    </div>
  )
}
