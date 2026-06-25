import { useEffect, useMemo, useRef, useState } from 'react'
import { defaultInstructions } from '../data/mockData'
import { isDataUrl, uploadBoothLogo, uploadEventAsset } from '../services/assetStorage'
import { readOptimizedImageFile } from '../utils/imageUpload'
import { getBoothLogoFrameStyle } from '../utils/boothLogoStyles'
import { PinchZoomMap } from './PinchZoomMap'
import { AdminToast } from './AdminToast'
import { WinnerWheel } from './WinnerWheel'

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
  logoColor: '#007b70',
  logoBackgroundColor: '#ffffff',
}

const adminSections = ['Events', 'Settings', 'Booths', 'Map', 'Signups', 'Raffle', 'Winner', 'Picked']
const emptyEventDraft = {
  id: '',
  name: '',
  status: 'hidden',
  createdAt: '',
  duplicateFromId: '',
  signupCode: '',
  experientActCode: '0000000000000000',
  experientBadgeId: '0',
}

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
  events,
  activeEvent,
  activeEventId,
  adminAccessToken,
  onSelectEvent,
  onSaveEvent,
  onDuplicateEvent,
  onArchiveEvent,
  onUnarchiveEvent,
  onSaveBooth,
  onMigrateEmbeddedBoothLogos,
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
}) {
  const formRef = useRef(null)
  const [draft, setDraft] = useState(emptyBooth)
  const [placementBoothId, setPlacementBoothId] = useState('')
  const [manualEntryMessage, setManualEntryMessage] = useState('')
  const [activeAdminSection, setActiveAdminSection] = useState('Settings')
  const [eventDraft, setEventDraft] = useState(emptyEventDraft)
  const [eventMessage, setEventMessage] = useState('')
  const [settingsMessage, setSettingsMessage] = useState('')
  const [boothMessage, setBoothMessage] = useState('')
  const [logoUploadPending, setLogoUploadPending] = useState(false)
  const [migrateLogosPending, setMigrateLogosPending] = useState(false)
  const embeddedLogoCount = useMemo(
    () => booths.filter((booth) => isDataUrl(booth.logoDataUrl)).length,
    [booths],
  )
  const instructionsText = (
    settings?.instructions?.length ? settings.instructions : defaultInstructions
  ).join('\n')
  const categoryText = (settings?.boothCategories ?? []).join('\n')
  const termsText = settings?.termsText ?? ''
  const boothCategoryOptions = useMemo(() => {
    const categorySet = new Set([
      ...(settings?.boothCategories ?? []),
      draft.category,
    ].filter(Boolean))

    return [...categorySet]
  }, [draft.category, settings?.boothCategories])

  useEffect(() => {
    setSettingsMessage('')
    setBoothMessage('')
  }, [activeEventId])

  const editBooth = (booth) => {
    setActiveAdminSection('Booths')
    setDraft({ ...emptyBooth, ...booth })
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
  const updateDraft = (field, value) =>
    setDraft((current) => ({ ...current, [field]: value }))
  const resolveBoothId = (booth) =>
    booth.id ||
    booth.name
      ?.toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') ||
    crypto.randomUUID()

  const uploadLogo = async (file) => {
    if (!file) return

    setLogoUploadPending(true)
    try {
      let imageDataUrl = await readOptimizedImageFile(file, {
        maxWidth: 512,
        maxHeight: 512,
        preferJpeg: true,
        quality: 0.84,
      })

      try {
        imageDataUrl = await uploadBoothLogo({
          eventId: activeEventId,
          boothId: resolveBoothId(draft),
          dataUrl: imageDataUrl,
          accessToken: adminAccessToken,
        })
      } catch (error) {
        console.warn(error)
        setBoothMessage('Logo upload failed. Check Supabase Storage setup.')
      }

      updateDraft('logoDataUrl', imageDataUrl)
    } finally {
      setLogoUploadPending(false)
    }
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
        eventId: activeEventId,
        assetType: field,
        dataUrl: imageDataUrl,
        accessToken: adminAccessToken,
      })
    } catch (error) {
      console.warn(error)
    }

    onSaveSettings({ [field]: imageDataUrl })
    setSettingsMessage('Image saved.')
  }

  const saveSettingsFromForm = (form) => {
    const formData = new FormData(form)
    const requiredScanCount = Number(formData.get('requiredScanCount'))

    if (!Number.isFinite(requiredScanCount) || requiredScanCount < 1) {
      setSettingsMessage('Enter a required scan count of at least 1.')
      return
    }

    if (booths.length > 0 && requiredScanCount > booths.length) {
      setSettingsMessage(
        `Required scan count cannot be more than ${booths.length} (number of booths).`,
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

    onSaveSettings({
      requiredScanCount,
      instructions,
      boothCategories,
      termsText: String(formData.get('termsText') ?? '').trim(),
    })
    setSettingsMessage('Settings saved.')
  }

  return (
    <section className="admin-panel">
      <AdminToast
        message={settingsMessage}
        onClear={() => setSettingsMessage('')}
      />
      <div className="admin-actions">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>{activeEvent?.name ?? 'Manage Passport Raffle'}</h2>
        </div>
        <div className="admin-quick-actions">
          <a className="button-link" href="/admin">
            View Admin Webpage
          </a>
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
        <div
          className="admin-list-section"
          hidden={activeAdminSection !== 'Events'}
        >
          <form
            className="manual-entry-form"
            onSubmit={async (event) => {
              event.preventDefault()
              const result = await onSaveEvent(eventDraft)
              setEventMessage(result.message)
              if (result.ok) setEventDraft(emptyEventDraft)
            }}
          >
            <h3>{eventDraft.id ? 'Edit event' : 'Create event'}</h3>
            <label className="form-field">
              <span>Event name</span>
              <input
                required
                value={eventDraft.name}
                onChange={(event) =>
                  setEventDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
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
            <label className="form-field">
              <span>Signup access code</span>
              <input
                value={eventDraft.signupCode ?? ''}
                onChange={(event) =>
                  setEventDraft((current) => ({
                    ...current,
                    signupCode: event.target.value,
                  }))
                }
                placeholder="lfxrocks"
              />
            </label>
            <label className="form-field">
              <span>Experient activation code</span>
              <input
                value={eventDraft.experientActCode ?? ''}
                onChange={(event) =>
                  setEventDraft((current) => ({
                    ...current,
                    experientActCode: event.target.value,
                  }))
                }
                placeholder="16-digit activation code"
              />
            </label>
            <label className="form-field">
              <span>Experient badge station ID</span>
              <input
                value={eventDraft.experientBadgeId ?? '0'}
                onChange={(event) =>
                  setEventDraft((current) => ({
                    ...current,
                    experientBadgeId: event.target.value,
                  }))
                }
                placeholder="0"
              />
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
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="submit" className="primary">
              {eventDraft.id ? 'Save event' : 'Create event'}
            </button>
            {eventMessage && <p className="muted">{eventMessage}</p>}
          </form>

          <div className="admin-section-heading">
            <h3>Events</h3>
          </div>
          {events.map((event) => (
            <article className="entry-card" key={event.id}>
              <strong>{event.name}</strong>
              <p className="muted">
                {event.status}
                {event.id === activeEventId ? ' / Current' : ''}
              </p>
              <div className="card-actions">
                <button
                  type="button"
                  disabled={event.id === activeEventId}
                  onClick={async () => {
                    const result = await onSelectEvent(event.id)
                    setEventMessage(result.message)
                  }}
                >
                  Open
                </button>
                <button type="button" onClick={() => setEventDraft(event)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const result = await onDuplicateEvent(event.id)
                    setEventMessage(result.message)
                  }}
                >
                  Duplicate
                </button>
                {event.status === 'active' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await onSaveEvent({
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
                      const result = await onSaveEvent({
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
                      const result = await onUnarchiveEvent(event.id)
                      setEventMessage(result.message)
                    }}
                  >
                    Unarchive
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await onArchiveEvent(event.id)
                      setEventMessage(result.message)
                    }}
                  >
                    Archive
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        <form
          key={activeEventId}
          className="settings-form"
          hidden={activeAdminSection !== 'Settings'}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            saveSettingsFromForm(event.currentTarget)
          }}
        >
          <h3>Raffle settings</h3>
          <label className="form-field">
            <span>Required scan count</span>
            <input
              name="requiredScanCount"
              type="number"
              min="1"
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
          <label className="form-field full">
            <span>Booth categories (one per line)</span>
            <textarea
              name="boothCategories"
              rows="4"
              defaultValue={categoryText}
              placeholder="Irrigation&#10;Lighting&#10;Hardscape"
            />
          </label>
          <label className="form-field full">
            <span>Terms of service</span>
            <textarea
              name="termsText"
              rows="5"
              defaultValue={termsText}
              placeholder="Enter the terms attendees must accept before signing up..."
            />
          </label>
          <label className="form-field full asset-upload-field">
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
          <label className="form-field full asset-upload-field">
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
          <label className="form-field full asset-upload-field">
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
            Save settings
          </button>
        </form>

        <form
          ref={formRef}
          className="booth-form"
          hidden={activeAdminSection !== 'Booths'}
          onSubmit={async (event) => {
            event.preventDefault()
            const result = await onSaveBooth(draft)
            setBoothMessage(result.message)
            if (result.ok) setDraft(emptyBooth)
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
            <select
              required
              value={draft.category}
              onChange={(event) => updateDraft('category', event.target.value)}
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
            <span>Booth Web Page</span>
            <input
              value={draft.websiteUrl}
              placeholder="https://example.com"
              onChange={(event) => updateDraft('websiteUrl', event.target.value)}
            />
          </label>
          <label className="form-field full">
            <span>
              Booth Logo
              {draft.logoDataUrl ? ' - logo attached' : ''}
              {logoUploadPending ? ' - uploading…' : ''}
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
            <div
              className="logo-preview"
              style={{
                backgroundColor: draft.logoBackgroundColor || '#ffffff',
              }}
            >
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
            <span>Logo background color</span>
            <input
              type="color"
              value={draft.logoBackgroundColor || '#ffffff'}
              onChange={(event) =>
                updateDraft('logoBackgroundColor', event.target.value)
              }
            />
          </label>
          <label className="form-field">
            <span>Logo color</span>
            <input
              type="color"
              value={draft.logoColor || draft.color || '#007b70'}
              onChange={(event) => updateDraft('logoColor', event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Map pin color</span>
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
              <span>Expo Booth</span>
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
              Select an expo booth, then tap the map where its booth belongs.
            </p>
            <PinchZoomMap
              booths={booths}
              completedIds={[]}
              onPlaceBooth={onPlaceBooth}
              placementBoothId={placementBoothId}
              mapSrc={settings?.mapSrc}
              mapVersion={settings?.remoteUpdatedAt}
              className="admin-placement-map"
              title="Place booth pins"
            />
          </div>

          <div
            className="admin-list-section"
            hidden={activeAdminSection !== 'Booths'}
          >
            <h3>Expo booths</h3>
            {embeddedLogoCount > 0 && (
              <div className="admin-inline-actions">
                <p className="muted">
                  {embeddedLogoCount} booth logo{embeddedLogoCount === 1 ? '' : 's'}{' '}
                  still stored inline in event data.
                </p>
                <button
                  type="button"
                  className="secondary"
                  disabled={migrateLogosPending}
                  onClick={async () => {
                    setMigrateLogosPending(true)
                    try {
                      const result = await onMigrateEmbeddedBoothLogos()
                      setBoothMessage(result.message)
                    } finally {
                      setMigrateLogosPending(false)
                    }
                  }}
                >
                  {migrateLogosPending ? 'Migrating logos…' : 'Migrate logos to Storage'}
                </button>
              </div>
            )}
            {boothMessage && <p className="muted">{boothMessage}</p>}
            {booths.map((booth) => (
              <article className="entry-card" key={booth.id}>
                <div className="admin-mobile-booth-heading">
                  <div
                    className="admin-manufacturer-logo"
                    style={getBoothLogoFrameStyle(booth)}
                  >
                    {booth.logoDataUrl ? (
                      <img src={booth.logoDataUrl} alt="" />
                    ) : (
                      <span>{booth.name.slice(0, 1)}</span>
                    )}
                  </div>
                  <div>
                    <strong>{booth.name}</strong>
                    <p className="muted">
                      {booth.location} / {booth.qrCode}
                    </p>
                  </div>
                </div>
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
            <WinnerWheel
              key={activeEventId}
              entries={entries}
              winners={winners}
              onWinnerSelected={onWinnerSelected}
            />
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
