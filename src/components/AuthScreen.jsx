import { useRef, useState } from 'react'
import { BadgeScanPanel } from './BadgeScanPanel'

const emptyRegistration = {
  name: '',
  email: '',
  phone: '',
  role: 'Landscape Architect',
  otherRole: '',
  acceptedTerms: false,
  signupCode: '',
}

const emptySignIn = {
  email: '',
  phone: '',
}

const emptyAdmin = {
  username: '',
  password: '',
}

const emptyBadgeConfirm = {
  name: '',
  email: '',
  phone: '',
  acceptedTerms: false,
}

const roles = ['Landscape Architect', 'Manufacturer', 'Student', 'Other']

export function AuthScreen({
  activeEvent,
  activeEvents = [],
  initialView = 'scan',
  attendeeMagicLinkEnabled = false,
  onRegister,
  onRegisterFromBadge,
  onLookupBadge,
  onSignIn,
  onSendMagicLink,
  onAdminSignIn,
  onSelectEvent,
  termsText = '',
  privacyPolicyUrl = '/privacy-policy.html',
}) {
  const [view, setView] = useState(initialView)
  const [scanStep, setScanStep] = useState('code')
  const [signupCode, setSignupCode] = useState('')
  const [badgeBarcode, setBadgeBarcode] = useState('')
  const [badgeLead, setBadgeLead] = useState(null)
  const [badgeConfirm, setBadgeConfirm] = useState(emptyBadgeConfirm)
  const [registration, setRegistration] = useState(emptyRegistration)
  const [signIn, setSignIn] = useState(emptySignIn)
  const [admin, setAdmin] = useState(emptyAdmin)
  const [adminUnlocked, setAdminUnlocked] = useState(initialView === 'admin')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const logoTapState = useRef({ count: 0, lastTapAt: 0 })
  const noAvailableEvents = activeEvents.length === 0
  const showAdminAuth = adminUnlocked || initialView === 'admin'
  const currentView = showAdminAuth || view !== 'admin' ? view : 'scan'

  const updateRegistration = (field, value) => {
    setRegistration((current) => ({ ...current, [field]: value }))
  }

  const updateBadgeConfirm = (field, value) => {
    setBadgeConfirm((current) => ({ ...current, [field]: value }))
  }

  const resetScanFlow = () => {
    setScanStep('code')
    setSignupCode('')
    setBadgeBarcode('')
    setBadgeLead(null)
    setBadgeConfirm(emptyBadgeConfirm)
    setMessage('')
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

  const handleContinueToScan = () => {
    const normalizedCode = signupCode.trim()
    if (!normalizedCode) {
      setMessage('Enter the event access code to continue.')
      return
    }
    setMessage('')
    setScanStep('scan')
  }

  const handleBadgeScan = async (barcode) => {
    if (!onLookupBadge || !activeEvent?.id) {
      setMessage('Badge lookup is unavailable right now.')
      return
    }

    setSubmitting(true)
    setBadgeBarcode(barcode)
    setMessage('Looking up your badge...')

    const result = await onLookupBadge({
      eventId: activeEvent.id,
      signupCode: signupCode.trim(),
      barcode,
    })

    setSubmitting(false)

    if (!result.ok) {
      setMessage(result.message)
      return
    }

    const lead = result.lead ?? {}
    setBadgeLead(lead)
    setBadgeConfirm({
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      acceptedTerms: false,
    })
    setScanStep('confirm')
    setMessage('')
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
            : 'Scan your badge to collect booth stamps and unlock your raffle entry.'}
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
            onChange={(event) => {
              onSelectEvent?.(event.target.value)
              resetScanFlow()
            }}
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
          className={currentView === 'scan' ? 'active' : ''}
          onClick={() => {
            setView('scan')
            resetScanFlow()
          }}
        >
          Scan Badge
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

      {!noAvailableEvents && currentView === 'scan' && scanStep === 'code' && (
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            handleContinueToScan()
          }}
        >
          <p className="auth-step-copy">
            Enter the event access code provided at the show to begin badge signup.
          </p>
          <label className="form-field">
            <span>Event Access Code</span>
            <input
              required
              autoComplete="off"
              value={signupCode}
              onChange={(event) => setSignupCode(event.target.value)}
              placeholder="Enter event code"
            />
          </label>
          <button type="submit" className="primary">
            Continue to Badge Scan
          </button>
          <button
            type="button"
            className="button-link auth-fallback-link"
            onClick={() => {
              setView('signup')
              setRegistration((current) => ({
                ...current,
                signupCode,
              }))
              setMessage('')
            }}
          >
            Can&apos;t scan your badge? Sign up manually
          </button>
        </form>
      )}

      {!noAvailableEvents && currentView === 'scan' && scanStep === 'scan' && (
        <div className="auth-form auth-scan-step">
          <p className="auth-step-copy">
            Scan the QR code on your show badge. We&apos;ll look up your registration
            details automatically.
          </p>
          <BadgeScanPanel disabled={submitting} onScan={handleBadgeScan} />
          <button
            type="button"
            className="button-link auth-fallback-link"
            disabled={submitting}
            onClick={() => setScanStep('code')}
          >
            Back to event code
          </button>
          <button
            type="button"
            className="button-link auth-fallback-link"
            disabled={submitting}
            onClick={() => {
              setView('signin')
              setMessage('')
            }}
          >
            Badge not working? Sign in instead
          </button>
        </div>
      )}

      {!noAvailableEvents && currentView === 'scan' && scanStep === 'confirm' && (
        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault()
            setSubmitting(true)
            const ok = await submitResult(
              onRegisterFromBadge?.({
                ...badgeConfirm,
                signupCode: signupCode.trim(),
                badgeBarcode,
                registrantId: badgeLead?.registrantId ?? '',
              }),
            )
            setSubmitting(false)
            if (ok) resetScanFlow()
          }}
        >
          <p className="auth-step-copy">
            Confirm your details below, then create your passport to start scanning booths.
          </p>
          <label className="form-field">
            <span>Name</span>
            <input
              required
              value={badgeConfirm.name}
              onChange={(event) => updateBadgeConfirm('name', event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input
              required
              type="email"
              value={badgeConfirm.email}
              onChange={(event) => updateBadgeConfirm('email', event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Phone Number</span>
            <input
              type="tel"
              value={badgeConfirm.phone}
              onChange={(event) => updateBadgeConfirm('phone', event.target.value)}
              placeholder="Optional if not on your badge"
            />
          </label>
          <div className="signup-terms">
            <div className="signup-terms-copy">
              {termsText ||
                'By creating a passport, I agree to participate in this raffle and allow my submitted information to be used for raffle administration and event follow-up.'}
            </div>
            <label className="signup-terms-check">
              <input
                required
                type="checkbox"
                checked={badgeConfirm.acceptedTerms}
                onChange={(event) =>
                  updateBadgeConfirm('acceptedTerms', event.target.checked)
                }
              />
              <span>I accept the terms of service.</span>
            </label>
          </div>
          <button
            type="submit"
            className="primary"
            disabled={!badgeConfirm.acceptedTerms || submitting}
          >
            {submitting ? 'Creating Passport...' : 'Create Passport'}
          </button>
          <button
            type="button"
            className="button-link auth-fallback-link"
            disabled={submitting}
            onClick={() => setScanStep('scan')}
          >
            Scan a different badge
          </button>
        </form>
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
          <p className="auth-step-copy">
            Manual signup fallback when badge scanning is unavailable.
          </p>
          <label className="form-field">
            <span>Event Access Code</span>
            <input
              required
              autoComplete="off"
              value={registration.signupCode}
              onChange={(event) => updateRegistration('signupCode', event.target.value)}
              placeholder="Enter event code"
            />
          </label>
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
          <button
            type="button"
            className="button-link auth-fallback-link"
            onClick={() => {
              setView('scan')
              setSignupCode(registration.signupCode)
              resetScanFlow()
              setSignupCode(registration.signupCode)
              setMessage('')
            }}
          >
            Back to badge scan
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
          <p className="auth-step-copy">
            Already signed up? Sign in with the email and phone you used during registration.
          </p>
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
          <button
            type="button"
            className="button-link auth-fallback-link"
            onClick={() => {
              setView('scan')
              resetScanFlow()
            }}
          >
            Need to sign up? Scan your badge
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
