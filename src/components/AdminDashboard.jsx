import { useEffect, useMemo, useState } from 'react'
import { defaultInstructions } from '../data/mockData'
import {
  getSupabaseUser,
  updateSupabasePassword,
} from '../services/adminAuth'
import { uploadEventAsset } from '../services/assetStorage'
import { readOptimizedImageFile } from '../utils/imageUpload'
import { PinchZoomMap } from './PinchZoomMap'
import { AdminToast } from './AdminToast'
import { BoothQrGenerator } from './BoothQrGenerator'
import { WinnerDancerShow } from './WinnerDancerShow'
import { WinnerConfetti } from './WinnerConfetti'

const emptyBooth = {
  id: '',
  name: '',
  category: '',
  location: '',
  description: '',
  websiteUrl: '',
  logoDataUrl: '',
  qrCode: '',
  color: '#007b70',
}

const emptyLogin = {
  username: '',
  password: '',
}

const emptyAdminUser = {
  email: '',
  name: '',
  role: 'admin',
}

const emptyManualEntry = {
  attendeeId: '',
  name: '',
  email: '',
  phone: '',
  role: '',
  chances: 1,
}

const emptyEventDraft = {
  id: '',
  name: '',
  status: 'hidden',
  createdAt: '',
  duplicateFromId: '',
}

function confirmWinnerReset() {
  return (
    window.confirm('Reset picked winners? This clears the winners history.') &&
    window.confirm('Are you absolutely sure? This cannot be undone.') &&
    window.confirm('Final confirmation: permanently clear all picked winners?')
  )
}

function hasAlreadyWon(entry, winners) {
  return winners.some((winner) => {
    if (entry.attendeeId && winner.attendeeId) return entry.attendeeId === winner.attendeeId
    return entry.email && winner.email && entry.email === winner.email
  })
}

function normalizeDate(value) {
  return value ? new Date(value).toLocaleString() : ''
}

function StatCard({ label, value }) {
  return (
    <article className="admin-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function getInviteAccessToken() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(window.location.search)
  const hashType = hashParams.get('type')
  const searchType = searchParams.get('type')
  const type = hashType || searchType
  const accessToken = hashParams.get('access_token') || searchParams.get('access_token')

  if (!accessToken || !['invite', 'recovery'].includes(type)) return ''
  return accessToken
}

export function AdminDashboard({ store }) {
  const [activeSection, setActiveSection] = useState('Booths')
  const [login, setLogin] = useState(emptyLogin)
  const [loginMessage, setLoginMessage] = useState('')
  const [loginPending, setLoginPending] = useState(false)
  const [draft, setDraft] = useState(emptyBooth)
  const [placementBoothId, setPlacementBoothId] = useState('')
  const [query, setQuery] = useState('')
  const [winnerSelection, setWinnerSelection] = useState({
    eventId: '',
    entry: null,
  })
  const [wheelRotation, setWheelRotation] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [manualEntry, setManualEntry] = useState(emptyManualEntry)
  const [manualEntryMessage, setManualEntryMessage] = useState('')
  const [scanProgressMessage, setScanProgressMessage] = useState('')
  const [showWinnerConfetti, setShowWinnerConfetti] = useState(false)
  const [danceModeIndex, setDanceModeIndex] = useState(0)
  const [adminUserDraft, setAdminUserDraft] = useState(emptyAdminUser)
  const [adminUserMessage, setAdminUserMessage] = useState('')
  const [inviteSession, setInviteSession] = useState(null)
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteConfirmPassword, setInviteConfirmPassword] = useState('')
  const [inviteMessage, setInviteMessage] = useState(() =>
    getInviteAccessToken() ? 'Loading your admin invitation...' : '',
  )
  const [invitePending, setInvitePending] = useState(false)
  const [eventDraft, setEventDraft] = useState(emptyEventDraft)
  const [eventMessage, setEventMessage] = useState('')
  const [settingsMessage, setSettingsMessage] = useState('')

  const instructionsText = (
    store.settings?.instructions?.length
      ? store.settings.instructions
      : defaultInstructions
  ).join('\n')
  const categoryText = (store.settings?.boothCategories ?? []).join('\n')
  const termsText = store.settings?.termsText ?? ''
  const boothCategoryOptions = useMemo(() => {
    const categorySet = new Set([
      ...(store.settings?.boothCategories ?? []),
      draft.category,
    ].filter(Boolean))

    return [...categorySet]
  }, [draft.category, store.settings?.boothCategories])
  const winner =
    winnerSelection.eventId === store.activeEventId ? winnerSelection.entry : null

  useEffect(() => {
    setSettingsMessage('')
  }, [store.activeEventId])

  const filteredBooths = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return store.booths

    return store.booths.filter((booth) =>
      [booth.name, booth.location, booth.category, booth.qrCode]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [query, store.booths])

  const wheelEntries = useMemo(
    () =>
      store.entries
        .filter((entry) => !hasAlreadyWon(entry, store.winners ?? []))
        .flatMap((entry) =>
          Array.from({ length: Math.max(1, Number(entry.chances) || 1) }, () => entry),
        ),
    [store.entries, store.winners],
  )

  const eligibleRaffleEntries = useMemo(
    () =>
      store.entries.filter(
        (entry) => !hasAlreadyWon(entry, store.winners ?? []),
      ),
    [store.entries, store.winners],
  )

  const attendeeProgressRows = useMemo(
    () =>
      store.attendees.map((attendee) => {
        const completedIds = store.attendeeProgress[attendee.id] ?? []
        const completedBooths = completedIds
          .map((id) => store.booths.find((booth) => booth.id === id)?.name)
          .filter(Boolean)

        return {
          attendee,
          completedIds,
          completedBooths,
          complete: completedIds.length >= store.requiredScanCount,
          entered: store.entries.some((entry) => entry.attendeeId === attendee.id),
        }
      }),
    [
      store.attendees,
      store.attendeeProgress,
      store.booths,
      store.entries,
      store.requiredScanCount,
    ],
  )

  useEffect(() => {
    const accessToken = getInviteAccessToken()
    if (!accessToken) return undefined

    let cancelled = false

    getSupabaseUser(accessToken)
      .then((user) => {
        if (cancelled) return
        const email = user?.email ?? ''
        setInviteSession({ accessToken, email })
        setLogin((current) => ({ ...current, username: email }))
        setInviteMessage('Create a password to finish your admin setup.')
      })
      .catch((error) => {
        console.warn(error)
        if (!cancelled) {
          setInviteMessage(
            'This admin invitation link is invalid or expired. Ask a super admin to resend it.',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const wheelGradient = useMemo(() => {
    if (!wheelEntries.length) {
      return 'conic-gradient(#f0f0f0 0deg 360deg)'
    }

    const colors = [
      '#111111',
      '#21a66b',
      '#f8c23a',
      '#245c6f',
      '#ec6f2d',
      '#6eb34f',
      '#2b8fa3',
      '#757575',
    ]
    const sliceAngle = 360 / wheelEntries.length

    return `conic-gradient(${wheelEntries
      .map((entry, index) => {
        const start = index * sliceAngle
        const end = (index + 1) * sliceAngle
        return `${colors[index % colors.length]} ${start}deg ${end}deg`
      })
      .join(', ')})`
  }, [wheelEntries])

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const uploadLogo = (file) => {
    if (!file) return

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      updateDraft('logoDataUrl', reader.result)
    })
    reader.readAsDataURL(file)
  }

  const uploadSettingsImage = async (field, file) => {
    if (!file) return

    let imageDataUrl = await readOptimizedImageFile(file, {
      maxWidth: field === 'mapSrc' ? 2400 : 1400,
      maxHeight: field === 'mapSrc' ? 2400 : 1400,
      preferJpeg: field === 'mapSrc',
      quality: 0.84,
    })

    try {
      imageDataUrl = await uploadEventAsset({
        eventId: store.activeEventId,
        assetType: field,
        dataUrl: imageDataUrl,
      })
    } catch (error) {
      console.warn(error)
    }

    store.saveSettings({ [field]: imageDataUrl })
    setSettingsMessage('Image saved.')
  }

  const saveSettingsFromForm = (form) => {
    const formData = new FormData(form)
    const requiredScanCount = Number(formData.get('requiredScanCount'))

    if (!Number.isFinite(requiredScanCount) || requiredScanCount < 1) {
      setSettingsMessage('Enter a required scan count of at least 1.')
      return
    }

    if (store.booths.length > 0 && requiredScanCount > store.booths.length) {
      setSettingsMessage(
        `Required scan count cannot be more than ${store.booths.length} (number of booths).`,
      )
      return
    }

    const instructions = String(formData.get('instructions') ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    const boothCategories = String(formData.get('boothCategories') ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    store.saveSettings({
      requiredScanCount,
      instructions,
      boothCategories,
      termsText: String(formData.get('termsText') ?? '').trim(),
    })
    setSettingsMessage('Settings saved.')
  }

  const saveDraft = () => {
    store.saveBooth(draft)
    setDraft(emptyBooth)
  }

  const spinWinner = () => {
    if (!wheelEntries.length || isSpinning) return

    const winnerIndex = Math.floor(Math.random() * wheelEntries.length)
    const sliceAngle = 360 / wheelEntries.length
    const landingAngle = 360 - (winnerIndex * sliceAngle + sliceAngle / 2)
    const selectedWinner = wheelEntries[winnerIndex]
    const drawEventId = store.activeEventId

    setWinnerSelection({ eventId: drawEventId, entry: null })
    setIsSpinning(true)
    setWheelRotation((currentRotation) => {
      const currentAngle = ((currentRotation % 360) + 360) % 360
      const correction = (landingAngle - currentAngle + 360) % 360
      return currentRotation + 1440 + correction
    })

    window.setTimeout(() => {
      setWinnerSelection({ eventId: drawEventId, entry: selectedWinner })
      store.recordWinner(selectedWinner)
      setIsSpinning(false)
      setDanceModeIndex((currentIndex) => (currentIndex + 1) % 3)
      setShowWinnerConfetti(true)
      window.setTimeout(() => {
        setShowWinnerConfetti(false)
      }, 4700)
    }, 3800)
  }

  if (!store.adminAuthenticated) {
    return (
      <main className="admin-dashboard-shell login-only">
        <section className="admin-login-card">
          <img src="/logos/landfx-logo-400w.png" alt="Land F/X" />
          <div>
            <p className="eyebrow">Admin Dashboard</p>
            <h1>Land F/X Passport Raffle</h1>
            <p>
              {inviteSession
                ? 'Finish setting up your invited admin account.'
                : 'Sign in with your Supabase admin account.'}
            </p>
          </div>
          {inviteSession ? (
            <form
              className="admin-login-form"
              onSubmit={async (event) => {
                event.preventDefault()

                if (invitePassword.length < 8) {
                  setInviteMessage('Password must be at least 8 characters.')
                  return
                }

                if (invitePassword !== inviteConfirmPassword) {
                  setInviteMessage('Passwords do not match.')
                  return
                }

                setInvitePending(true)
                try {
                  await updateSupabasePassword(
                    inviteSession.accessToken,
                    invitePassword,
                  )
                  window.history.replaceState(null, '', '/admin')
                  const result = await store.signInAdmin({
                    username: inviteSession.email,
                    password: invitePassword,
                  })
                  setInviteMessage(result.message)
                  if (!result.ok) {
                    setLogin((current) => ({
                      ...current,
                      username: inviteSession.email,
                      password: '',
                    }))
                    setInviteSession(null)
                  }
                } catch (error) {
                  console.warn(error)
                  setInviteMessage(
                    'Unable to set this admin password. The invite may be expired.',
                  )
                } finally {
                  setInvitePending(false)
                }
              }}
            >
              <label className="form-field">
                <span>Admin Email</span>
                <input
                  disabled
                  autoCapitalize="none"
                  type="email"
                  value={inviteSession.email}
                />
              </label>
              <label className="form-field">
                <span>Create Password</span>
                <input
                  required
                  type="password"
                  value={invitePassword}
                  onChange={(event) => setInvitePassword(event.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Confirm Password</span>
                <input
                  required
                  type="password"
                  value={inviteConfirmPassword}
                  onChange={(event) =>
                    setInviteConfirmPassword(event.target.value)
                  }
                />
              </label>
              <button type="submit" className="primary" disabled={invitePending}>
                {invitePending ? 'Saving...' : 'Create Password'}
              </button>
            </form>
          ) : (
            <form
              className="admin-login-form"
              onSubmit={async (event) => {
                event.preventDefault()
                setLoginPending(true)
                const result = await store.signInAdmin(login)
                setLoginMessage(result.message)
                setLoginPending(false)
              }}
            >
              <label className="form-field">
                <span>Admin Email</span>
                <input
                  required
                  autoCapitalize="none"
                  type="email"
                  value={login.username}
                  onChange={(event) =>
                    setLogin((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Admin Password</span>
                <input
                  required
                  type="password"
                  value={login.password}
                  onChange={(event) =>
                    setLogin((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
              </label>
              <button type="submit" className="primary" disabled={loginPending}>
                {loginPending ? 'Checking...' : 'Open Dashboard'}
              </button>
            </form>
          )}
          {inviteMessage && <p className="status-note">{inviteMessage}</p>}
          {loginMessage && <p className="status-note">{loginMessage}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="admin-dashboard-shell">
      <AdminToast
        message={settingsMessage}
        onClear={() => setSettingsMessage('')}
      />
      <aside className="admin-sidebar">
        <img src="/logos/landfx-logo-400w.png" alt="Land F/X" />
        <div>
          <p className="eyebrow">Passport Raffle</p>
          <h1>Admin</h1>
        </div>
        <nav aria-label="Admin sections">
          {[
            'Events',
            'Booths',
            'Map',
            'Settings',
            'Scan Progress',
            'Signups',
            'Raffle Entries',
            'Winner Picker',
            'Winners',
            'Admin Users',
          ].map((section) => (
              <button
                type="button"
                key={section}
                className={activeSection === section ? 'active' : ''}
                onClick={() => setActiveSection(section)}
              >
                {section}
              </button>
            ))}
        </nav>
        <div className="admin-sidebar-actions">
          <a href="/" className="button-link">
            View App
          </a>
          <button
            type="button"
            onClick={() => store.signOutAdmin()}
          >
            Lock Admin
          </button>
        </div>
      </aside>

      <section className="admin-dashboard-main">
        <header className="admin-dashboard-header">
          <div>
            <p className="eyebrow">
              {store.activeEvent?.name ?? 'Live Shared Admin'}
            </p>
            <h2>{activeSection}</h2>
          </div>
          <div className="admin-header-actions">
            <button
              type="button"
              onClick={store.exportAttendeesCsv}
              disabled={!store.attendees.length}
            >
              Export Signups CSV
            </button>
            <button
              type="button"
              onClick={store.exportEntriesCsv}
              disabled={!store.entries.length}
            >
              Export Raffle CSV
            </button>
          </div>
        </header>

        <div className="admin-stat-grid">
          <StatCard label="Event" value={store.activeEvent?.name ?? 'None'} />
          <StatCard label="Booths" value={store.booths.length} />
          <StatCard label="Required Scans" value={store.requiredScanCount} />
          <StatCard label="Signups" value={store.attendees.length} />
          <StatCard label="Wheel Entries" value={wheelEntries.length} />
        </div>

        {activeSection === 'Events' && (
          <section className="admin-workspace two-column">
            <form
              className="desktop-card admin-editor-form"
              onSubmit={async (event) => {
                event.preventDefault()
                const result = await store.saveEvent(eventDraft)
                setEventMessage(result.message)
                if (result.ok) setEventDraft(emptyEventDraft)
              }}
            >
              <div>
                <p className="eyebrow">
                  {eventDraft.id ? 'Editing Event' : 'New Event'}
                </p>
                <h3>{eventDraft.id ? eventDraft.name : 'Create Event'}</h3>
              </div>
              <label className="form-field">
                <span>Event Name</span>
                <input
                  required
                  value={eventDraft.name}
                  onChange={(event) =>
                    setEventDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="ASLA Los Angeles 2026"
                />
              </label>
              <label className="form-field">
                <span>Status</span>
                <select
                  value={eventDraft.status}
                  onChange={(event) =>
                    setEventDraft((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="hidden">Hidden / Setup</option>
                  <option value="active">Live / Show in app</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              {!eventDraft.id && (
                <label className="form-field">
                  <span>Copy setup from</span>
                  <select
                    value={eventDraft.duplicateFromId ?? ''}
                    onChange={(event) =>
                      setEventDraft((current) => ({
                        ...current,
                        duplicateFromId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Blank event</option>
                    {store.events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="admin-form-actions">
                <button type="submit" className="primary">
                  {eventDraft.id ? 'Save Event' : 'Create Event'}
                </button>
                <button
                  type="button"
                  onClick={() => setEventDraft(emptyEventDraft)}
                >
                  Clear
                </button>
              </div>
              {eventMessage && <p className="admin-muted">{eventMessage}</p>}
              <p className="admin-muted">
                Events keep booths, scans, entries, winners, and settings
                separate. Copy setup duplicates booths and settings only — not
                attendees, scans, or raffle entries.
              </p>
            </form>

            <div className="desktop-card">
              <div className="table-toolbar">
                <h3>Events</h3>
                <span className="admin-muted">
                  {store.events.length} total
                </span>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.events.map((event) => (
                      <tr key={event.id}>
                        <td>
                          <strong>{event.name}</strong>
                          {event.id === store.activeEventId && <span>Current</span>}
                        </td>
                        <td>{event.status}</td>
                        <td>{normalizeDate(event.createdAt)}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              disabled={event.id === store.activeEventId}
                              onClick={async () => {
                                const result = await store.selectEvent(event.id)
                                setEventMessage(result.message)
                              }}
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => setEventDraft(event)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const result = await store.duplicateEvent(event.id)
                                setEventMessage(result.message)
                              }}
                            >
                              Duplicate
                            </button>
                            {event.status === 'active' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const result = await store.saveEvent({
                                    ...event,
                                    status: 'hidden',
                                  })
                                  setEventMessage(result.message)
                                }}
                              >
                                Hide
                              </button>
                            )}
                            {event.status === 'hidden' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const result = await store.saveEvent({
                                    ...event,
                                    status: 'active',
                                  })
                                  setEventMessage(result.message)
                                }}
                              >
                                Show
                              </button>
                            )}
                            {event.status === 'archived' ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  const result = await store.unarchiveEvent(event.id)
                                  setEventMessage(result.message)
                                }}
                              >
                                Unarchive
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  const result = await store.archiveEvent(event.id)
                                  setEventMessage(result.message)
                                }}
                              >
                                Archive
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'Booths' && (
          <section className="admin-workspace two-column">
            <div className="admin-booth-column">
            <form
              className="desktop-card admin-editor-form"
              onSubmit={(event) => {
                event.preventDefault()
                saveDraft()
              }}
            >
              <div>
                <p className="eyebrow">{draft.id ? 'Editing' : 'New Booth'}</p>
                <h3>{draft.id ? draft.name : 'Add Expo Booth'}</h3>
              </div>
              <div className="admin-form-grid">
                <label className="form-field">
                  <span>Name</span>
                  <input
                    required
                    value={draft.name}
                    onChange={(event) => updateDraft('name', event.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Category</span>
                  <select
                    required
                    value={draft.category}
                    onChange={(event) =>
                      updateDraft('category', event.target.value)
                    }
                  >
                    <option value="" disabled>
                      Add categories in Settings
                    </option>
                    {boothCategoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Location</span>
                  <input
                    required
                    value={draft.location}
                    onChange={(event) =>
                      updateDraft('location', event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  <span>QR Code</span>
                  <input
                    required
                    value={draft.qrCode}
                    onChange={(event) => updateDraft('qrCode', event.target.value)}
                  />
                </label>
                <label className="form-field full">
                  <span>Booth Web Page</span>
                  <input
                    value={draft.websiteUrl}
                    placeholder="https://example.com"
                    onChange={(event) =>
                      updateDraft('websiteUrl', event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  <span>Logo Color</span>
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(event) => updateDraft('color', event.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Logo{draft.logoDataUrl ? ' - logo attached' : ''}</span>
                  <input
                    key={draft.logoDataUrl ? 'logo-attached' : 'logo-empty'}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(event) => {
                      uploadLogo(event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                </label>
                <label className="form-field full">
                  <span>Description</span>
                  <textarea
                    required
                    value={draft.description}
                    onChange={(event) =>
                      updateDraft('description', event.target.value)
                    }
                  />
                </label>
              </div>
              {draft.logoDataUrl && (
                <div className="logo-preview">
                  <img src={draft.logoDataUrl} alt={`${draft.name} logo preview`} />
                  <span>Current logo attached</span>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => updateDraft('logoDataUrl', '')}
                  >
                    Remove logo
                  </button>
                </div>
              )}
              <div className="admin-form-actions">
                <button type="submit" className="primary">
                  {draft.id ? 'Save Booth' : 'Add Booth'}
                </button>
                <button type="button" onClick={() => setDraft(emptyBooth)}>
                  Clear
                </button>
              </div>
            </form>

            <BoothQrGenerator
              booths={store.booths}
              selectedBoothId={draft.id}
              qrCode={draft.qrCode}
              onSelectBooth={(boothId) => {
                const booth = store.booths.find((item) => item.id === boothId)
                if (booth) setDraft({ ...emptyBooth, ...booth })
              }}
            />
            </div>

            <div className="desktop-card">
              <div className="table-toolbar">
                <h3>Expo Booths</h3>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search booths"
                />
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Expo Booth</th>
                      <th>Booth</th>
                      <th>QR Code</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBooths.map((booth) => (
                      <tr key={booth.id}>
                        <td>
                          <div className="admin-manufacturer-cell">
                            <div
                              className="admin-manufacturer-logo"
                              style={{ '--logo-bg': booth.color }}
                            >
                              {booth.logoDataUrl ? (
                                <img src={booth.logoDataUrl} alt="" />
                              ) : (
                                <span>{booth.name.slice(0, 1)}</span>
                              )}
                            </div>
                            <div>
                              <strong>{booth.name}</strong>
                              <span>{booth.category}</span>
                            </div>
                          </div>
                        </td>
                        <td>{booth.location}</td>
                        <td>{booth.qrCode}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              onClick={() => setDraft({ ...emptyBooth, ...booth })}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => {
                                if (window.confirm(`Delete ${booth.name}?`)) {
                                  store.deleteBooth(booth.id)
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'Map' && (
          <section className="admin-workspace">
            <div className="desktop-card">
              <div className="map-admin-toolbar">
                <div>
                  <h3>Map Placement</h3>
                  <p>
                    Select an expo booth, then click the map to save its pin.
                  </p>
                </div>
                <label className="form-field">
                  <span>Expo Booth</span>
                  <select
                    value={placementBoothId}
                    onChange={(event) => setPlacementBoothId(event.target.value)}
                  >
                    <option value="">Select a booth</option>
                    {store.booths.map((booth) => (
                      <option key={booth.id} value={booth.id}>
                        {booth.name} / {booth.location}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <PinchZoomMap
                booths={store.booths}
                completedIds={[]}
                onPlaceBooth={store.placeBoothOnMap}
                placementBoothId={placementBoothId}
                mapSrc={store.settings?.mapSrc}
                mapVersion={store.settings?.remoteUpdatedAt}
                className="desktop-placement-map"
                title="Place booth pins"
              />
            </div>
          </section>
        )}

        {activeSection === 'Settings' && (
          <section className="admin-workspace narrow">
            <form
              key={store.activeEventId}
              className="desktop-card admin-editor-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                saveSettingsFromForm(event.currentTarget)
              }}
            >
              <div>
                <p className="eyebrow">Raffle Settings</p>
                <h3>Completion Rules & Instructions</h3>
              </div>
              <label className="form-field">
                <span>Required scan count</span>
                <input
                  name="requiredScanCount"
                  type="number"
                  min="1"
                  defaultValue={store.settings?.requiredScanCount ?? 4}
                />
              </label>
              <label className="form-field">
                <span>Instructions, one per line</span>
                <textarea
                  name="instructions"
                  rows="9"
                  defaultValue={instructionsText}
                />
              </label>
              <label className="form-field">
                <span>Booth categories, one per line</span>
                <textarea
                  name="boothCategories"
                  rows="5"
                  defaultValue={categoryText}
                  placeholder="Irrigation&#10;Lighting&#10;Hardscape"
                />
              </label>
              <label className="form-field">
                <span>Terms of service</span>
                <textarea
                  name="termsText"
                  rows="6"
                  defaultValue={termsText}
                  placeholder="Enter the terms attendees must accept before signing up..."
                />
              </label>
              <label className="form-field asset-upload-field">
                <span>Home screen image</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(event) =>
                    uploadSettingsImage('homeImageSrc', event.target.files?.[0])
                  }
                />
                <small>Recommended: 1200 x 700 px PNG/JPG.</small>
              </label>
              <label className="form-field asset-upload-field">
                <span>Raffle completed image</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(event) =>
                    uploadSettingsImage('raffleCompleteImageSrc', event.target.files?.[0])
                  }
                />
                <small>Recommended: 1200 x 800 px transparent PNG/JPG.</small>
              </label>
              <label className="form-field asset-upload-field">
                <span>Expo map image</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(event) =>
                    uploadSettingsImage('mapSrc', event.target.files?.[0])
                  }
                />
                <small>
                  Recommended: 3000 x 2000 px or larger PNG/JPG. Keep the same crop
                  if replacing later so saved booth pins stay aligned.
                </small>
              </label>
              <button type="submit" className="primary">
                Save Settings
              </button>
            </form>
          </section>
        )}

        {activeSection === 'Signups' && (
          <section className="admin-workspace">
            <div className="desktop-card">
              <div className="table-toolbar">
                <h3>App Signups</h3>
                <button
                  type="button"
                  onClick={store.exportAttendeesCsv}
                  disabled={!store.attendees.length}
                >
                  Export Signups CSV
                </button>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>Scans</th>
                      <th>Signed Up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.attendees.map((attendee) => (
                      <tr key={attendee.id}>
                        <td>{attendee.name}</td>
                        <td>{attendee.email}</td>
                        <td>{attendee.phone}</td>
                        <td>{attendee.role}</td>
                        <td>
                          {store.attendeeProgress[attendee.id]?.length ?? 0}/
                          {store.requiredScanCount}
                        </td>
                        <td>{normalizeDate(attendee.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'Scan Progress' && (
          <section className="admin-workspace">
            <div className="desktop-card">
              <div className="table-toolbar">
                <h3>Live Scan Progress</h3>
                <span className="admin-muted">
                  {attendeeProgressRows.filter((row) => row.complete).length} complete
                </span>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Progress</th>
                      <th>Scanned Booths</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendeeProgressRows.map((row) => (
                      <tr key={row.attendee.id}>
                        <td>
                          <strong>{row.attendee.name}</strong>
                          <span>{row.attendee.email}</span>
                        </td>
                        <td>
                          <div className="admin-progress-cell">
                            <strong>
                              {row.completedIds.length}/{store.requiredScanCount}
                            </strong>
                            <div className="admin-progress-track">
                              <span
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (row.completedIds.length /
                                      store.requiredScanCount) *
                                      100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>{row.completedBooths.join(', ') || 'No scans yet'}</td>
                        <td>{row.complete ? 'Entered / qualified' : 'In progress'}</td>
                        <td>
                          <button
                            type="button"
                            disabled={row.entered}
                            onClick={() => {
                              const result = store.addRaffleEntry({
                                attendeeId: row.attendee.id,
                                chances: 1,
                              })
                              setScanProgressMessage(result.message)
                            }}
                          >
                            {row.entered ? 'Entered' : 'Enter Raffle'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {scanProgressMessage && (
                <p className="admin-muted">{scanProgressMessage}</p>
              )}
            </div>
          </section>
        )}

        {activeSection === 'Raffle Entries' && (
          <section className="admin-workspace">
            <div className="desktop-card">
              <div className="table-toolbar">
                <h3>Raffle Entries</h3>
                <button
                  type="button"
                  onClick={store.exportEntriesCsv}
                  disabled={!store.entries.length}
                >
                  Export Raffle CSV
                </button>
              </div>
              <form
                className="manual-entry-inline"
                onSubmit={(event) => {
                  event.preventDefault()
                  const result = store.addRaffleEntry(manualEntry)
                  setManualEntryMessage(result.message)
                  if (result.ok) setManualEntry(emptyManualEntry)
                }}
              >
                <label className="form-field">
                  <span>Existing signup</span>
                  <select
                    value={manualEntry.attendeeId}
                    onChange={(event) =>
                      setManualEntry((current) => ({
                        ...current,
                        attendeeId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Manual entry</option>
                    {store.attendees.map((attendee) => (
                      <option key={attendee.id} value={attendee.id}>
                        {attendee.name}
                      </option>
                    ))}
                  </select>
                </label>
                {['name', 'email', 'phone', 'role'].map((field) => (
                  <label className="form-field" key={field}>
                    <span>{field}</span>
                    <input
                      type={field === 'email' ? 'email' : 'text'}
                      value={manualEntry[field]}
                      onChange={(event) =>
                        setManualEntry((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
                <label className="form-field">
                  <span>Wheel entries</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={manualEntry.chances}
                    onChange={(event) =>
                      setManualEntry((current) => ({
                        ...current,
                        chances: event.target.value,
                      }))
                    }
                  />
                </label>
                <button type="submit" className="primary">
                  Add Entry
                </button>
                {manualEntryMessage && <p className="admin-muted">{manualEntryMessage}</p>}
              </form>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>Wheel Entries</th>
                      <th>Entered</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.name}</td>
                        <td>{entry.email}</td>
                        <td>{entry.phone}</td>
                        <td>{entry.role}</td>
                        <td>
                          <input
                            className="table-number-input"
                            type="number"
                            min="1"
                            max="99"
                            value={entry.chances ?? 1}
                            onChange={(event) =>
                              store.updateEntryChances(entry.id, event.target.value)
                            }
                          />
                        </td>
                        <td>{normalizeDate(entry.submittedAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              if (window.confirm(`Delete raffle entry for ${entry.name}?`)) {
                                store.deleteRaffleEntry(entry.id)
                              }
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'Winner Picker' && (
          <section className="admin-workspace winner-workspace">
            <WinnerConfetti active={showWinnerConfetti} />
            {winner && showWinnerConfetti && (
              <div className="winner-reveal-overlay" aria-live="polite">
                <div className="winner-ribbon-banner">
                  <span>Winner Selected</span>
                  <strong>{winner.name}</strong>
                </div>
                <WinnerDancerShow modeIndex={danceModeIndex} />
              </div>
            )}
            <div className="desktop-card winner-card">
              <div className="table-toolbar">
                <div>
                  <p className="eyebrow">Prize Wheel</p>
                  <h3>Pick a Random Winner</h3>
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={spinWinner}
                  disabled={!wheelEntries.length || isSpinning}
                >
                  {isSpinning ? 'Spinning...' : 'Spin Wheel'}
                </button>
              </div>

              <div className="winner-layout">
                <div className="wheel-zone" aria-live="polite">
                  <div className="wheel-pointer" />
                  <div
                    className="prize-wheel"
                    style={{
                      background: wheelGradient,
                      transform: `rotate(${wheelRotation}deg)`,
                    }}
                  >
                    <div className="wheel-center">
                      <strong>{eligibleRaffleEntries.length}</strong>
                      <span>People</span>
                    </div>
                  </div>
                </div>

                <aside className="winner-panel">
                  <div className="winner-result">
                    <span>{winner ? 'Winner Selected' : 'Ready to Draw'}</span>
                    <strong>{winner?.name ?? 'No winner yet'}</strong>
                    {winner && (
                      <>
                        <p>{winner.company || winner.role}</p>
                      </>
                    )}
                  </div>

                  <div className="eligible-list">
                    <h4>Eligible Raffle Entries ({wheelEntries.length} wheel spots)</h4>
                    {eligibleRaffleEntries.length ? (
                      <details className="eligible-details">
                        <summary>Show eligible names</summary>
                        <ul>
                          {eligibleRaffleEntries.map((entry) => (
                            <li key={entry.id}>
                              <span>{entry.name}</span>
                              <small>{entry.chances ?? 1}x</small>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <p>
                        No raffle entries yet. Qualified attendees will appear
                        here automatically.
                      </p>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'Winners' && (
          <section className="admin-workspace">
            <div className="desktop-card">
              <div className="table-toolbar">
                <h3>Picked Winners</h3>
                <button
                  type="button"
                  className="danger"
                  disabled={!store.winners?.length}
                  onClick={() => {
                    if (confirmWinnerReset()) store.resetWinners()
                  }}
                >
                  Reset Winners
                </button>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>Wheel Entries</th>
                      <th>Picked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(store.winners ?? []).map((pickedWinner) => (
                      <tr key={pickedWinner.id}>
                        <td>{pickedWinner.name}</td>
                        <td>{pickedWinner.email}</td>
                        <td>{pickedWinner.phone}</td>
                        <td>{pickedWinner.role}</td>
                        <td>{pickedWinner.chances ?? 1}</td>
                        <td>{normalizeDate(pickedWinner.pickedAt)}</td>
                      </tr>
                    ))}
                    {!store.winners?.length && (
                      <tr>
                        <td colSpan="6">No winners picked yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'Admin Users' && (
          <section className="admin-workspace two-column">
            <form
              className="desktop-card admin-editor-form"
              onSubmit={async (event) => {
                event.preventDefault()
                const result = await store.addAdminUser(adminUserDraft)
                setAdminUserMessage(result.message)
                if (result.ok) setAdminUserDraft(emptyAdminUser)
              }}
            >
              <div>
                <p className="eyebrow">Supabase Auth</p>
                <h3>Invite Admin</h3>
              </div>
              <label className="form-field">
                <span>Email</span>
                <input
                  required
                  type="email"
                  value={adminUserDraft.email}
                  onChange={(event) =>
                    setAdminUserDraft((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Name</span>
                <input
                  value={adminUserDraft.name}
                  onChange={(event) =>
                    setAdminUserDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Role</span>
                <select
                  value={adminUserDraft.role}
                  onChange={(event) =>
                    setAdminUserDraft((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </label>
              <button type="submit" className="primary">
                Send Invite
              </button>
              {adminUserMessage && <p className="admin-muted">{adminUserMessage}</p>}
              <p className="admin-muted">
                Sends a Supabase invite email and authorizes this email for admin
                access.
              </p>
            </form>

            <div className="desktop-card">
              <div className="table-toolbar">
                <h3>Authorized Admins</h3>
                <button type="button" onClick={store.refreshAdminUsers}>
                  Refresh
                </button>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.adminUsers.map((adminUser) => (
                      <tr key={adminUser.email}>
                        <td>{adminUser.name || 'Admin'}</td>
                        <td>{adminUser.email}</td>
                        <td>{adminUser.role}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              onClick={async () => {
                                const result = await store.resetAdminPassword(
                                  adminUser.email,
                                )
                                setAdminUserMessage(result.message)
                              }}
                            >
                              Resend Invite
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const result = await store.resetAdminPassword(
                                  adminUser.email,
                                )
                                setAdminUserMessage(result.message)
                              }}
                            >
                              Send Reset
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={async () => {
                                if (
                                  window.confirm(
                                    `Remove admin access for ${adminUser.email}?`,
                                  )
                                ) {
                                  const result = await store.removeAdminUser(adminUser.email)
                                  setAdminUserMessage(result.message)
                                }
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!store.adminUsers.length && (
                      <tr>
                        <td colSpan="4">No authorized admins loaded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}
