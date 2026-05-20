import { useRef, useState } from 'react'
import { defaultInstructions } from '../data/mockData'
import { PinchZoomMap } from './PinchZoomMap'
import { WinnerWheel } from './WinnerWheel'

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

const adminSections = ['Settings', 'Booths', 'Map', 'Signups', 'Raffle', 'Winner', 'Picked']

function confirmWinnerReset() {
  return (
    window.confirm('Reset picked winners? This clears the winners history.') &&
    window.confirm('Are you absolutely sure? This cannot be undone.') &&
    window.confirm('Final confirmation: permanently clear all picked winners?')
  )
}

export function AdminPanel({
  booths,
  attendees,
  entries,
  winners,
  attendeeProgress,
  requiredScanCount,
  onSaveBooth,
  onDeleteBooth,
  onPlaceBooth,
  onAddRaffleEntry,
  onUpdateEntryChances,
  onDeleteRaffleEntry,
  onWinnerSelected,
  onResetWinners,
  settings,
  onSaveSettings,
  onExportCsv,
  onExportAttendeesCsv,
  onResetDemo,
}) {
  const formRef = useRef(null)
  const [draft, setDraft] = useState(emptyBooth)
  const [placementBoothId, setPlacementBoothId] = useState('')
  const [manualEntryMessage, setManualEntryMessage] = useState('')
  const [activeAdminSection, setActiveAdminSection] = useState('Settings')
  const instructionsText = (
    settings?.instructions?.length ? settings.instructions : defaultInstructions
  ).join('\n')

  const editBooth = (booth) => {
    setActiveAdminSection('Booths')
    setDraft({ ...emptyBooth, ...booth })
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
  const updateDraft = (field, value) =>
    setDraft((current) => ({ ...current, [field]: value }))
  const uploadLogo = (file) => {
    if (!file) return

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      updateDraft('logoDataUrl', reader.result)
    })
    reader.readAsDataURL(file)
  }

  return (
    <section className="admin-panel">
      <div className="admin-actions">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Manage Passport Raffle</h2>
        </div>
        <div className="admin-quick-actions">
          <a className="button-link" href="/admin">
            View Admin Webpage
          </a>
          <button type="button" className="danger" onClick={onResetDemo}>
            Reset demo
          </button>
        </div>
      </div>

      <nav className="mobile-admin-tabs" aria-label="Admin sections">
        {adminSections.map((section) => (
          <button
            type="button"
            key={section}
            className={activeAdminSection === section ? 'active' : ''}
            onClick={() => setActiveAdminSection(section)}
          >
            {section}
          </button>
        ))}
      </nav>

      <div className="admin-grid">
        <form
          className="settings-form"
          hidden={activeAdminSection !== 'Settings'}
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            const nextInstructionsText = String(formData.get('instructions') ?? '')
            const instructions = nextInstructionsText
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
            onSaveSettings({
              requiredScanCount: formData.get('requiredScanCount'),
              instructions,
            })
          }}
        >
          <h3>Raffle settings</h3>
          <label className="form-field">
            <span>Required scan count</span>
            <input
              name="requiredScanCount"
              type="number"
              min="1"
              max={booths.length}
              defaultValue={settings?.requiredScanCount ?? 4}
            />
          </label>
          <label className="form-field full">
            <span>Instructions (one per line)</span>
            <textarea
              name="instructions"
              rows="6"
              defaultValue={instructionsText}
              placeholder="Enter each instruction on a new line..."
            />
          </label>
          <button type="submit" className="primary">
            Save settings
          </button>
        </form>

        <form
          ref={formRef}
          className="booth-form"
          hidden={activeAdminSection !== 'Booths'}
          onSubmit={(event) => {
            event.preventDefault()
            onSaveBooth(draft)
            setDraft(emptyBooth)
          }}
        >
          {draft.id && (
            <div className="edit-banner">
              Editing <strong>{draft.name}</strong>
            </div>
          )}
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
              onChange={(event) => updateDraft('category', event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Location</span>
            <input
              required
              value={draft.location}
              onChange={(event) => updateDraft('location', event.target.value)}
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
              onChange={(event) => updateDraft('websiteUrl', event.target.value)}
            />
          </label>
          <label className="form-field full">
            <span>
              Manufacturer Logo
              {draft.logoDataUrl ? ' - logo attached' : ''}
            </span>
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
          <label className="form-field">
            <span>Logo Color</span>
            <input
              type="color"
              value={draft.color}
              onChange={(event) => updateDraft('color', event.target.value)}
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
          <button type="submit" className="primary">
            {draft.id ? 'Save booth' : 'Add booth'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(emptyBooth)
              formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            Clear
          </button>
        </form>

        <div className="entry-list">
          <div
            className="admin-map-placement"
            hidden={activeAdminSection !== 'Map'}
          >
            <h3>Map placement</h3>
            <label className="form-field">
              <span>Manufacturer</span>
              <select
                value={placementBoothId}
                onChange={(event) => setPlacementBoothId(event.target.value)}
              >
                <option value="">Select a booth</option>
                {booths.map((booth) => (
                  <option key={booth.id} value={booth.id}>
                    {booth.name} / {booth.location}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              Select a manufacturer, then tap the map where its booth belongs.
            </p>
            <PinchZoomMap
              booths={booths}
              completedIds={[]}
              onPlaceBooth={onPlaceBooth}
              placementBoothId={placementBoothId}
              className="admin-placement-map"
              title="Place booth pins"
            />
          </div>

          <div
            className="admin-list-section"
            hidden={activeAdminSection !== 'Booths'}
          >
            <h3>Manufacturer booths</h3>
            {booths.map((booth) => (
              <article className="entry-card" key={booth.id}>
                <strong>{booth.name}</strong>
                <p className="muted">
                  {booth.location} / {booth.qrCode}
                </p>
                <div className="card-actions">
                  <button type="button" onClick={() => editBooth(booth)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      if (window.confirm(`Delete ${booth.name}?`)) {
                        onDeleteBooth(booth.id)
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div
            className="admin-list-section"
            hidden={activeAdminSection !== 'Signups'}
          >
            <div className="admin-section-heading">
              <h3>App signups ({attendees.length})</h3>
              <button type="button" onClick={onExportAttendeesCsv}>
                Export CSV
              </button>
            </div>
            {attendees.length === 0 ? (
              <p className="muted">No app signups yet.</p>
            ) : (
              attendees.map((attendee) => (
                <article className="entry-card" key={attendee.id}>
                  <strong>{attendee.name}</strong>
                  <div className="entry-meta">
                    <span className="pill">{attendee.role}</span>
                    <span className="pill">{attendee.email}</span>
                    <span className="pill">{attendee.phone}</span>
                    <span className="pill">
                      {attendeeProgress[attendee.id]?.length ?? 0}/{requiredScanCount} scans
                    </span>
                  </div>
                  <p className="muted">
                    {new Date(attendee.createdAt).toLocaleString()}
                  </p>
                </article>
              ))
            )}
          </div>

          <div
            className="admin-mobile-wheel-card"
            hidden={activeAdminSection !== 'Winner'}
          >
            <WinnerWheel entries={entries} onWinnerSelected={onWinnerSelected} />
          </div>

          <div
            className="admin-list-section"
            hidden={activeAdminSection !== 'Raffle'}
          >
            <form
              className="manual-entry-form"
              onSubmit={(event) => {
                event.preventDefault()
                const formData = new FormData(event.currentTarget)
                const result = onAddRaffleEntry({
                  attendeeId: formData.get('attendeeId'),
                  name: formData.get('name'),
                  email: formData.get('email'),
                  phone: formData.get('phone'),
                  role: formData.get('role'),
                  chances: formData.get('chances'),
                })
                setManualEntryMessage(result.message)
                if (result.ok) event.currentTarget.reset()
              }}
            >
              <h3>Add raffle entry</h3>
              <label className="form-field">
                <span>Existing signup</span>
                <select name="attendeeId">
                  <option value="">Manual entry</option>
                  {attendees.map((attendee) => (
                    <option key={attendee.id} value={attendee.id}>
                      {attendee.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Name</span>
                <input name="name" placeholder="Manual name" />
              </label>
              <label className="form-field">
                <span>Email</span>
                <input name="email" type="email" placeholder="Manual email" />
              </label>
              <label className="form-field">
                <span>Phone</span>
                <input name="phone" placeholder="Manual phone" />
              </label>
              <label className="form-field">
                <span>Role</span>
                <input name="role" placeholder="Manual role" />
              </label>
              <label className="form-field">
                <span>Wheel entries</span>
                <input name="chances" type="number" min="1" max="99" defaultValue="1" />
              </label>
              <button type="submit" className="primary">
                Add entry
              </button>
              {manualEntryMessage && <p className="muted">{manualEntryMessage}</p>}
            </form>

            <div className="admin-section-heading">
              <h3>Raffle entries ({entries.length})</h3>
              <button type="button" onClick={onExportCsv} disabled={!entries.length}>
                Export CSV
              </button>
            </div>
            {entries.length === 0 ? (
              <p className="muted">No raffle entries yet.</p>
            ) : (
              entries.map((entry) => (
                <article className="entry-card" key={entry.id}>
                  <strong>{entry.name}</strong>
                  <div className="entry-meta">
                    <span className="pill">{entry.role}</span>
                    <span className="pill">{entry.email}</span>
                    <span className="pill">{entry.phone}</span>
                    <span className="pill">{entry.chances ?? 1} wheel entries</span>
                  </div>
                  <label className="form-field compact-field">
                    <span>Wheel entries</span>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={entry.chances ?? 1}
                      onChange={(event) =>
                        onUpdateEntryChances(entry.id, event.target.value)
                      }
                    />
                  </label>
                  <div className="card-actions">
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        if (window.confirm(`Delete raffle entry for ${entry.name}?`)) {
                          onDeleteRaffleEntry(entry.id)
                        }
                      }}
                    >
                      Delete entry
                    </button>
                  </div>
                  <p className="muted">
                    {new Date(entry.submittedAt).toLocaleString()}
                  </p>
                </article>
              ))
            )}
          </div>

          <div
            className="admin-list-section"
            hidden={activeAdminSection !== 'Picked'}
          >
            <div className="admin-section-heading">
              <h3>Picked winners ({winners?.length ?? 0})</h3>
              <button
                type="button"
                className="danger"
                disabled={!winners?.length}
                onClick={() => {
                  if (confirmWinnerReset()) onResetWinners()
                }}
              >
                Reset
              </button>
            </div>
            {winners?.length ? (
              winners.map((winner) => (
                <article className="entry-card" key={winner.id}>
                  <strong>{winner.name}</strong>
                  <div className="entry-meta">
                    <span className="pill">{winner.role}</span>
                    <span className="pill">{winner.email}</span>
                    <span className="pill">{winner.phone}</span>
                  </div>
                  <p className="muted">{new Date(winner.pickedAt).toLocaleString()}</p>
                </article>
              ))
            ) : (
              <p className="muted">No winners picked yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
