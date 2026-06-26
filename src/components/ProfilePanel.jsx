export function ProfilePanel({ attendee, onSignOut }) {
  if (!attendee) {
    return (
      <section className="profile-panel">
        <p className="empty-state">No profile information available.</p>
      </section>
    )
  }

  return (
    <section className="profile-panel">
      <h2>Profile</h2>
      <dl className="profile-details">
        <div>
          <dt>Name</dt>
          <dd>{attendee.name}</dd>
        </div>
        <div>
          <dt>Email address</dt>
          <dd>{attendee.email}</dd>
        </div>
      </dl>
      <button type="button" className="primary profile-sign-out" onClick={onSignOut}>
        Log out
      </button>
    </section>
  )
}
