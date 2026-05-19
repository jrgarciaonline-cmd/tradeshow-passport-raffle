import { useState } from 'react'
import { adminCredentials } from '../data/mockData'

const emptyRegistration = {
  name: '',
  email: '',
  phone: '',
  role: 'Landscape Architect',
  otherRole: '',
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

export function AuthScreen({ initialView = 'signup', onRegister, onSignIn, onAdminSignIn }) {
  const [view, setView] = useState(initialView)
  const [registration, setRegistration] = useState(emptyRegistration)
  const [signIn, setSignIn] = useState(emptySignIn)
  const [admin, setAdmin] = useState(emptyAdmin)
  const [message, setMessage] = useState('')

  const updateRegistration = (field, value) => {
    setRegistration((current) => ({ ...current, [field]: value }))
  }

  const submitResult = (result) => {
    setMessage(result.message)
    return result.ok
  }

  return (
    <section className="auth-screen">
      <img
        className="auth-logo"
        src="/logos/landfx-logo-400w.png"
        alt="Land F/X"
      />
      <div>
        <h1>Passport Raffle</h1>
        <p>Sign in to collect booth scans and unlock your raffle entry.</p>
      </div>

      <div className="auth-tabs" aria-label="Sign in options">
        <button
          type="button"
          className={view === 'signup' ? 'active' : ''}
          onClick={() => {
            setView('signup')
            setMessage('')
          }}
        >
          Sign Up
        </button>
        <button
          type="button"
          className={view === 'signin' ? 'active' : ''}
          onClick={() => {
            setView('signin')
            setMessage('')
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          className={view === 'admin' ? 'active' : ''}
          onClick={() => {
            setView('admin')
            setMessage('')
          }}
        >
          Admin
        </button>
      </div>

      {view === 'signup' && (
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (submitResult(onRegister(registration))) {
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
          <button type="submit" className="primary">
            Create Passport
          </button>
        </form>
      )}

      {view === 'signin' && (
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            submitResult(onSignIn(signIn))
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
          <button type="submit" className="primary">
            Open Passport
          </button>
        </form>
      )}

      {view === 'admin' && (
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            submitResult(onAdminSignIn(admin))
          }}
        >
          <label className="form-field">
            <span>Admin Username</span>
            <input
              required
              autoCapitalize="none"
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
          <p className="demo-credentials">
            Demo admin: {adminCredentials.username} / {adminCredentials.password}
          </p>
          <button type="submit" className="primary">
            Open Admin
          </button>
        </form>
      )}

      {message && <p className="status-note">{message}</p>}
    </section>
  )
}
