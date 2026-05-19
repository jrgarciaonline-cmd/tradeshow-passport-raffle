import { useState } from 'react'

const emptyEntry = {
  name: '',
  email: '',
  phone: '',
  company: '',
}

export function RaffleForm({ disabled, onSubmit, latestEntry }) {
  const [entry, setEntry] = useState(emptyEntry)

  const updateField = (field, value) => {
    setEntry((current) => ({ ...current, [field]: value }))
  }

  return (
    <section className="raffle-panel">
      <div>
        <h2>{disabled ? 'Raffle locked' : 'Enter the raffle'}</h2>
        <p>
          {disabled
            ? 'Complete the required number of booth scans to open this entry form.'
            : 'Passport complete. Add your contact details for the drawing.'}
        </p>
      </div>
      <form
        className="raffle-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(entry)
          setEntry(emptyEntry)
        }}
      >
        {Object.keys(emptyEntry).map((field) => (
          <label className="form-field" key={field}>
            <span>{field}</span>
            <input
              required
              disabled={disabled}
              type={field === 'email' ? 'email' : 'text'}
              value={entry[field]}
              onChange={(event) => updateField(field, event.target.value)}
            />
          </label>
        ))}
        <button type="submit" className="primary" disabled={disabled}>
          Submit entry
        </button>
      </form>
      {latestEntry && (
        <p className="status-note">
          Latest entry received for {latestEntry.name} at{' '}
          {new Date(latestEntry.submittedAt).toLocaleTimeString()}.
        </p>
      )}
    </section>
  )
}
