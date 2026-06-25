import { useRef, useState } from 'react'

const emptyRegistration = {
  name: '',
  email: '',
  phone: '',
  role: 'Landscape Architect',
  otherRole: '',
  acceptedTerms: false,
}

const emptySignIn = {
  email: '',
  phone: '',
}

const emptyAdmin = {
  username: '',
  password: '',
}

const roles = ['Landscape Architect', 'Manufacturer', 'Student', 'Other']

export function AuthScreen({
  activeEvent,
  activeEvents = [],
  initialView = 'signup',
  attendeeMagicLinkEnabled = false,
  onRegister,
  onSignIn,
  onSendMagicLink,
  onAdminSignIn,
  onSelectEvent,
  termsText = '',
  privacyPolicyUrl = '/privacy-policy.html',
}) {
  const [view, setView] = useState(initialView)
  const [registration, setRegistration] = useState(emptyRegistration)
  const [signIn, setSignIn] = useState(emptySignIn)
  const [admin, setAdmin] = useState(emptyAdmin)
  const [adminUnlocked, setAdminUnlocked] = useState(initialView === 'admin')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const logoTapState = useRef({ count: 0, lastTapAt: 0 })
  const noAvailableEvents = activeEvents.length === 0
  const showAdminAuth = adminUnlocked || initialView === 'admin'
  const currentView = showAdminAuth || view !== 'admin' ? view : 'signup'

  const updateRegistration = (field, value) => {
    setRegistration((current) => ({ ...current, [field]: value }))
  }

  const handleLogoTap = () => {
    const now = Date.now()
    const nextCount =
      now - logoTapState.current.lastTapAt < 900
        ? logoTapState.current.count + 1
        : 1

    logoTapState.current = { count: nextCount, lastTapAt: now }

    if (nextCount >= 3) {
      setAdminUnlocked(true)
      setView('admin')
      setMessage('')
      logoTapState.current = { count: 0, lastTapAt: 0 }
    }
  }

  const submitResult = async (result) => {
    const resolvedResult = await result
    setMessage(resolvedResult.message)
    return resolvedResult.ok
  }

  return (
    <section className={`auth-screen ${noAvailableEvents ? 'no-events' : ''}`}>
      <button
        type="button"
        className="auth-logo-button"
        onClick={handleLogoTap}
        aria-label="Land F/X logo"
      >
        <img
          className="auth-logo"
          src="/logos/landfx-logo-400w.png"
          alt="Land F/X"
        />
      </button>
      <div>
        <h1>Passport Raffle</h1>
        <p>
          {noAvailableEvents
            ? 'No passport raffle events are available right now.'
            : activeEvent?.name
            ? activeEvent.name
            : 'Sign in to collect booth scans and unlock your raffle entry.'}
        </p>
      </div>

      {noAvailableEvents && currentView !== 'admin' && (
        <div className="no-events-card">
          <strong>No Available Events</strong>
          <span>Please check back when the raffle is live.</span>
        </div>
      )}

      {activeEvents.length > 0 && (
        <label className="form-field event-select-field">
          <span>Event</span>
          <select
            value={activeEvent?.id ?? activeEvents[0]?.id ?? ''}
            onChange={(event) => onSelectEvent?.(event.target.value)}
          >
            {activeEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {!noAvailableEvents && (
      <div
        className={`auth-tabs ${showAdminAuth ? '' : 'attendee-only'}`}
        aria-label="Sign in options"
      >
        <button
          type="button"
          className={currentView === 'signup' ? 'active' : ''}
          onClick={() => {
            setView('signup')
            setMessage('')
          }}
        >
          Sign Up
        </button>
        <button
          type="button"
          className={currentView === 'signin' ? 'active' : ''}
          onClick={() => {
            setView('signin')
            setMessage('')
          }}
        >
          Sign In
        </button>
        {showAdminAuth && (
          <button
            type="button"
            className={currentView === 'admin' ? 'active' : ''}
            onClick={() => {
              setView('admin')
              setMessage('')
            }}
          >
            Admin
          </button>
        )}
      </div>
      )}

      {!noAvailableEvents && currentView === 'signup' && (
        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (await submitResult(onRegister(registration))) {
              setRegistration(emptyRegistration)
            }
          }}
        >
          <label className="form-field">
            <span>Name</span>
            <input
              required
              value={registration.name}
              onChange={(event) => updateRegistration('name', event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input
              required
              type="email"
              value={registration.email}
              onChange={(event) => updateRegistration('email', event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Phone Number</span>
            <input
              required
              type="tel"
              value={registration.phone}
              onChange={(event) => updateRegistration('phone', event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Role in Industry</span>
            <select
              required
              value={registration.role}
              onChange={(event) => updateRegistration('role', event.target.value)}
            >
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>
          {registration.role === 'Other' && (
            <label className="form-field">
              <span>Other Role</span>
              <input
                required
                value={registration.otherRole}
                onChange={(event) =>
                  updateRegistration('otherRole', event.target.value)
                }
              />
            </label>
          )}
          <div className="signup-terms">
            <div className="signup-terms-copy">
              {termsText ||
                'By creating a passport, I agree to participate in this raffle and allow my submitted information to be used for raffle administration and event follow-up.'}
            </div>
            <label className="signup-terms-check">
              <input
                required
                type="checkbox"
                checked={registration.acceptedTerms}
                onChange={(event) =>
                  updateRegistration('acceptedTerms', event.target.checked)
                }
              />
              <span>I accept the terms of service.</span>
            </label>
          </div>
          <button
            type="submit"
            className="primary"
            disabled={!registration.acceptedTerms}
          >
            Create Passport
          </button>
        </form>
      )}

      {!noAvailableEvents && currentView === 'signin' && (
        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (attendeeMagicLinkEnabled) {
              setSubmitting(true)
              await submitResult(onSendMagicLink?.(signIn.email))
              setSubmitting(false)
              return
            }
            await submitResult(onSignIn(signIn))
          }}
        >
          <label className="form-field">
            <span>Email</span>
            <input
              required
              type="email"
              value={signIn.email}
              onChange={(event) =>
                setSignIn((current) => ({ ...current, email: event.target.value }))
              }
            />
          </label>
          {!attendeeMagicLinkEnabled && (
            <label className="form-field">
              <span>Phone Number</span>
              <input
                required
                type="tel"
                value={signIn.phone}
                onChange={(event) =>
                  setSignIn((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </label>
          )}
          {attendeeMagicLinkEnabled && (
            <p className="admin-muted">
              We will email you a secure sign-in link. No password required.
            </p>
          )}
          <button type="submit" className="primary" disabled={submitting}>
            {attendeeMagicLinkEnabled
              ? submitting
                ? 'Sending link...'
                : 'Email Me a Sign-In Link'
              : 'Open Passport'}
          </button>
        </form>
      )}

      {currentView === 'admin' && showAdminAuth && (
        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault()
            setSubmitting(true)
            await submitResult(onAdminSignIn(admin))
            setSubmitting(false)
          }}
        >
          <label className="form-field">
            <span>Admin Email</span>
            <input
              required
              autoCapitalize="none"
              type="email"
              value={admin.username}
              onChange={(event) =>
                setAdmin((current) => ({ ...current, username: event.target.value }))
              }
            />
          </label>
          <label className="form-field">
            <span>Admin Password</span>
            <input
              required
              type="password"
              value={admin.password}
              onChange={(event) =>
                setAdmin((current) => ({ ...current, password: event.target.value }))
              }
            />
          </label>
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Checking...' : 'Open Admin'}
          </button>
        </form>
      )}

      {message && <p className="status-note">{message}</p>}

      {!noAvailableEvents && currentView !== 'admin' && (
        <p className="admin-muted auth-privacy-note">
          <a href={privacyPolicyUrl} target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
        </p>
      )}
    </section>
  )
}
