export function RaffleEntryPanel({
  disabled,
  attendee,
  hasEntered,
  latestEntry,
  onEnter,
}) {
  return (
    <section className="raffle-panel">
      <div>
        <h2>
          {disabled
            ? 'Raffle locked'
            : hasEntered
              ? 'Raffle entry received'
              : 'Enter raffle drawing'}
        </h2>
        <p>
          {disabled
            ? 'Complete the required number of booth scans to unlock the drawing.'
            : hasEntered
              ? 'You are entered using your sign up information.'
              : 'Passport complete. Enter using your sign up information.'}
        </p>
      </div>

      {!disabled && attendee && (
        <div className="raffle-profile">
          <strong>{attendee.name}</strong>
          <span>{attendee.email}</span>
          <span>{attendee.phone}</span>
          <span>{attendee.role}</span>
        </div>
      )}

      <button
        type="button"
        className="primary"
        disabled={disabled || hasEntered || !attendee}
        onClick={onEnter}
      >
        {hasEntered ? 'Entered' : 'Enter raffle drawing'}
      </button>

      {latestEntry && (
        <p className="status-note">
          Entry received for {latestEntry.name} at{' '}
          {new Date(latestEntry.submittedAt).toLocaleTimeString()}.
        </p>
      )}
    </section>
  )
}
