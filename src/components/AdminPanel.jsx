import { useRef, useState } from 'react'
import { defaultInstructions } from '../data/mockData'
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

export function AdminPanel({
  booths,
  entries,
  onSaveBooth,
  onDeleteBooth,
  onPlaceBooth,
  settings,
  onSaveSettings,
  onExportCsv,
  onResetDemo,
}) {
  const formRef = useRef(null)
  const [draft, setDraft] = useState(emptyBooth)
  const [placementBoothId, setPlacementBoothId] = useState('')
  const instructionsText = (
    settings?.instructions?.length ? settings.instructions : defaultInstructions
  ).join('\n')

  const editBooth = (booth) => {
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
          <p className="eyebrow">Admin Mock</p>
          <h2>Manage manufacturer booths and raffle entries</h2>
        </div>
        <button type="button" onClick={onExportCsv} disabled={!entries.length}>
          Export CSV
        </button>
        <button type="button" className="danger" onClick={onResetDemo}>
          Reset demo
        </button>
      </div>

      <div className="admin-grid">
        <form
          className="settings-form"
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
            <span>Manufacturer Logo PNG</span>
            <input
              type="file"
              accept="image/png"
              onChange={(event) => uploadLogo(event.target.files?.[0])}
            />
          </label>
          {draft.logoDataUrl && (
            <div className="logo-preview">
              <img src={draft.logoDataUrl} alt={`${draft.name} logo preview`} />
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
          <div className="admin-map-placement">
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
                  onClick={() => onDeleteBooth(booth.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}

          <h3>Raffle entries</h3>
          {entries.length === 0 ? (
            <p className="muted">No raffle entries yet.</p>
          ) : (
            entries.map((entry) => (
              <article className="entry-card" key={entry.id}>
                <strong>{entry.name}</strong>
                <div className="entry-meta">
                  <span className="pill">{entry.company}</span>
                  <span className="pill">{entry.email}</span>
                  <span className="pill">{entry.phone}</span>
                </div>
                <p className="muted">
                  {new Date(entry.submittedAt).toLocaleString()}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
