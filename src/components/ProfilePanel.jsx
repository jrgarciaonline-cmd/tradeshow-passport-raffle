export function ProfilePanel({ attendee, onSignOut, onClose }) {
  if (!attendee) {
    return (
      <section className="profile-panel">
        <header className="profile-panel-header">
          <button
            type="button"
            className="profile-back-button"
            onClick={onClose}
            aria-label="Back"
          >
            ‹ Back
          </button>
        </header>
        <p className="empty-state">No profile information available.</p>
      </section>
    )
  }

  return (
    <section className="profile-panel">
      <header className="profile-panel-header">
        <button
          type="button"
          className="profile-back-button"
          onClick={onClose}
          aria-label="Back"
        >
          ‹ Back
        </button>
        <h2>Profile</h2>
      </header>
      <dl className="profile-details">
        <div>
          <dt>Name</dt>
          <dd>{attendee.name}</dd>
        </div>
        <div>
          <dt>Email address</dt>
          <dd>{attendee.email}</dd>
        </div>
        <div>
          <dt>Phone number</dt>
          <dd>{attendee.phone?.trim() || 'Not provided'}</dd>
        </div>
      </dl>
      <button type="button" className="primary profile-sign-out" onClick={onSignOut}>
        Log out
      </button>
    </section>
  )
}
