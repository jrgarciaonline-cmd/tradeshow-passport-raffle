import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'

function buildDownloadName(booth) {
  const label = booth?.name || booth?.id || 'booth'
  return `${label.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'booth'}-qr.png`
}

export function BoothQrGenerator({ booths, selectedBoothId, qrCode, onSelectBooth }) {
  const canvasRef = useRef(null)
  const [error, setError] = useState('')
  const trimmedCode = qrCode.trim()
  const selectedBooth = booths.find((booth) => booth.id === selectedBoothId) ?? null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !trimmedCode) {
      setError('')
      return undefined
    }

    let cancelled = false

    QRCode.toCanvas(canvas, trimmedCode, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
      .then(() => {
        if (!cancelled) setError('')
      })
      .catch(() => {
        if (!cancelled) setError('Unable to generate QR code.')
      })

    return () => {
      cancelled = true
    }
  }, [trimmedCode])

  const downloadPng = () => {
    const canvas = canvasRef.current
    if (!canvas || !trimmedCode || error) return

    const link = document.createElement('a')
    link.download = buildDownloadName(selectedBooth)
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="desktop-card booth-qr-generator">
      <div>
        <p className="eyebrow">Printable Codes</p>
        <h3>QR Code Generator</h3>
      </div>
      <label className="form-field">
        <span>Booth</span>
        <select
          value={selectedBoothId}
          onChange={(event) => onSelectBooth(event.target.value)}
        >
          <option value="">Select a booth</option>
          {booths.map((booth) => (
            <option key={booth.id} value={booth.id}>
              {booth.name} / {booth.location}
            </option>
          ))}
        </select>
      </label>
      <p className="admin-muted">
        {selectedBoothId
          ? `Generating from the QR Code field${selectedBooth ? ` for ${selectedBooth.name}` : ''}.`
          : 'Select a booth to load its QR code into the form above.'}
      </p>
      {trimmedCode ? (
        <div className="booth-qr-preview-wrap">
          <canvas ref={canvasRef} className="booth-qr-preview" aria-label="Generated QR code preview" />
          <p className="admin-muted booth-qr-value">{trimmedCode}</p>
          {error && <p className="admin-muted booth-qr-error">{error}</p>}
          <button
            type="button"
            className="primary"
            onClick={downloadPng}
            disabled={Boolean(error)}
          >
            Download PNG
          </button>
        </div>
      ) : (
        <p className="admin-muted">Enter a QR code in the booth form to generate a printable code.</p>
      )}
    </div>
  )
}
