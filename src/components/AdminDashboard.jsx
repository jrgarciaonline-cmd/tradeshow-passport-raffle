import { useMemo, useState } from 'react'
import { adminCredentials, defaultInstructions } from '../data/mockData'
import { PinchZoomMap } from './PinchZoomMap'

const emptyBooth = {
  id: '',
  name: '',
  category: 'Irrigation',
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

const emptyManualEntry = {
  attendeeId: '',
  name: '',
  email: '',
  phone: '',
  role: '',
  chances: 1,
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

export function AdminDashboard({ store }) {
  const [activeSection, setActiveSection] = useState('Booths')
  const [login, setLogin] = useState(emptyLogin)
  const [loginMessage, setLoginMessage] = useState('')
  const [draft, setDraft] = useState(emptyBooth)
  const [placementBoothId, setPlacementBoothId] = useState('')
  const [query, setQuery] = useState('')
  const [winner, setWinner] = useState(null)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [manualEntry, setManualEntry] = useState(emptyManualEntry)
  const [manualEntryMessage, setManualEntryMessage] = useState('')

  const instructionsText = (
    store.settings?.instructions?.length
      ? store.settings.instructions
      : defaultInstructions
  ).join('\n')

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
      store.entries.flatMap((entry) =>
        Array.from({ length: Math.max(1, Number(entry.chances) || 1) }, () => entry),
      ),
    [store.entries],
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
        }
      }),
    [store.attendees, store.attendeeProgress, store.booths, store.requiredScanCount],
  )

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

    setWinner(null)
    setIsSpinning(true)
    setWheelRotation((currentRotation) => {
      const currentAngle = ((currentRotation % 360) + 360) % 360
      const correction = (landingAngle - currentAngle + 360) % 360
      return currentRotation + 1440 + correction
    })

    window.setTimeout(() => {
      setWinner(selectedWinner)
      setIsSpinning(false)
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
            <p>Sign in to manage booths, map pins, settings, and exports.</p>
          </div>
          <form
            className="admin-login-form"
            onSubmit={(event) => {
              event.preventDefault()
              const result = store.signInAdmin(login)
              setLoginMessage(result.message)
            }}
          >
            <label className="form-field">
              <span>Admin Username</span>
              <input
                required
                autoCapitalize="none"
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
            <p className="demo-credentials">
              Demo admin: {adminCredentials.username} / {adminCredentials.password}
            </p>
            <button type="submit" className="primary">
              Open Dashboard
            </button>
          </form>
          {loginMessage && <p className="status-note">{loginMessage}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="admin-dashboard-shell">
      <aside className="admin-sidebar">
        <img src="/logos/landfx-logo-400w.png" alt="Land F/X" />
        <div>
          <p className="eyebrow">Passport Raffle</p>
          <h1>Admin</h1>
        </div>
        <nav aria-label="Admin sections">
          {[
            'Booths',
            'Map',
            'Settings',
            'Scan Progress',
            'Signups',
            'Raffle Entries',
            'Winner Picker',
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
            <p className="eyebrow">Live Shared Admin</p>
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
          <StatCard label="Booths" value={store.booths.length} />
          <StatCard label="Required Scans" value={store.requiredScanCount} />
          <StatCard label="Signups" value={store.attendees.length} />
          <StatCard label="Wheel Entries" value={wheelEntries.length} />
        </div>

        {activeSection === 'Booths' && (
          <section className="admin-workspace two-column">
            <form
              className="desktop-card admin-editor-form"
              onSubmit={(event) => {
                event.preventDefault()
                saveDraft()
              }}
            >
              <div>
                <p className="eyebrow">{draft.id ? 'Editing' : 'New Booth'}</p>
                <h3>{draft.id ? draft.name : 'Add Manufacturer Booth'}</h3>
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
                  <input
                    required
                    value={draft.category}
                    onChange={(event) =>
                      updateDraft('category', event.target.value)
                    }
                  />
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
                  <span>Manufacturer Web Page</span>
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

            <div className="desktop-card">
              <div className="table-toolbar">
                <h3>Manufacturer Booths</h3>
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
                      <th>Manufacturer</th>
                      <th>Booth</th>
                      <th>QR Code</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBooths.map((booth) => (
                      <tr key={booth.id}>
                        <td>
                          <strong>{booth.name}</strong>
                          <span>{booth.category}</span>
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
                    Select a manufacturer, then click the expo map to save its pin.
                  </p>
                </div>
                <label className="form-field">
                  <span>Manufacturer</span>
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
                className="desktop-placement-map"
                title="Place booth pins"
              />
            </div>
          </section>
        )}

        {activeSection === 'Settings' && (
          <section className="admin-workspace narrow">
            <form
              className="desktop-card admin-editor-form"
              onSubmit={(event) => {
                event.preventDefault()
                const formData = new FormData(event.currentTarget)
                const instructions = String(formData.get('instructions') ?? '')
                  .split('\n')
                  .map((line) => line.trim())
                  .filter((line) => line.length > 0)

                store.saveSettings({
                  requiredScanCount: formData.get('requiredScanCount'),
                  instructions,
                })
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
                  max={store.booths.length}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                  disabled={!store.entries.length || isSpinning}
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
                      <strong>{store.entries.length}</strong>
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
                        <p>{winner.email}</p>
                      </>
                    )}
                  </div>

                  <div className="eligible-list">
                    <h4>Eligible Raffle Entries ({wheelEntries.length} wheel spots)</h4>
                    {store.entries.length ? (
                      <ul>
                        {store.entries.map((entry) => (
                          <li key={entry.id}>
                            <span>{entry.name}</span>
                            <small>{entry.chances ?? 1}x / {entry.company || entry.email}</small>
                          </li>
                        ))}
                      </ul>
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
      </section>
    </main>
  )
}
