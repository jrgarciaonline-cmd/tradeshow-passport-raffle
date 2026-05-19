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
          {['Booths', 'Map', 'Settings', 'Signups', 'Raffle Entries'].map(
            (section) => (
              <button
                type="button"
                key={section}
                className={activeSection === section ? 'active' : ''}
                onClick={() => setActiveSection(section)}
              >
                {section}
              </button>
            ),
          )}
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
          <StatCard label="Raffle Entries" value={store.entries.length} />
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
                  <span>Logo PNG{draft.logoDataUrl ? ' - logo attached' : ''}</span>
                  <input
                    key={draft.logoDataUrl ? 'logo-attached' : 'logo-empty'}
                    type="file"
                    accept="image/png"
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
                              onClick={() => store.deleteBooth(booth.id)}
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
                        <td>{normalizeDate(attendee.createdAt)}</td>
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
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Role</th>
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
                        <td>{normalizeDate(entry.submittedAt)}</td>
                      </tr>
                    ))}
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
