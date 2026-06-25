import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { resolveApiUrl } from '../services/apiBaseUrl'
import { isSignedQrEnabled } from '../utils/scanToken'

function buildDownloadName(booth) {
  const label = booth?.name || booth?.id || 'booth'
  return `${label.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'booth'}-qr.png`
}

export function BoothQrGenerator({
  booths,
  selectedBoothId,
  qrCode,
  eventId,
  getAdminAccessToken,
  onSelectBooth,
}) {
  const canvasRef = useRef(null)
  const [error, setError] = useState('')
  const [signedToken, setSignedToken] = useState('')
  const [loadingSignedToken, setLoadingSignedToken] = useState(false)
  const selectedBooth = booths.find((booth) => booth.id === selectedBoothId) ?? null
  const useSignedQr = isSignedQrEnabled()
  const trimmedCode = useSignedQr
    ? selectedBoothId && eventId
      ? signedToken.trim()
      : ''
    : qrCode.trim()

  useEffect(() => {
    if (!useSignedQr || !eventId || !selectedBoothId) {
      return undefined
    }

    let cancelled = false

    const loadSignedToken = async () => {
      setLoadingSignedToken(true)
      setError('')

      try {
        const accessToken = await getAdminAccessToken?.()
        if (!accessToken) {
          if (!cancelled) {
            setSignedToken('')
            setError('Admin session required to generate signed QR codes.')
          }
          return
        }

        const response = await fetch(resolveApiUrl('/api/sign-scan-token'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            eventId,
            boothId: selectedBoothId,
          }),
        })

        const result = await response.json().catch(() => ({ ok: false }))
        if (!response.ok || !result.ok) {
          if (!cancelled) {
            setSignedToken('')
            setError(result.message || 'Unable to sign QR token.')
          }
          return
        }

        if (!cancelled) {
          setSignedToken(result.token)
        }
      } catch {
        if (!cancelled) {
          setSignedToken('')
          setError('Unable to sign QR token.')
        }
      } finally {
        if (!cancelled) setLoadingSignedToken(false)
      }
    }

    loadSignedToken()

    return () => {
      cancelled = true
    }
  }, [useSignedQr, eventId, selectedBoothId, getAdminAccessToken])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !trimmedCode) {
      setError((current) => (loadingSignedToken ? current : ''))
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
  }, [trimmedCode, loadingSignedToken])

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
        {useSignedQr
          ? 'Signed QR mode is enabled. Codes are generated server-side and cannot be forged from booth JSON.'
          : selectedBoothId
            ? `Generating from the QR Code field${selectedBooth ? ` for ${selectedBooth.name}` : ''}.`
            : 'Select a booth to load its QR code into the form above.'}
      </p>
      {loadingSignedToken && <p className="admin-muted">Signing QR token…</p>}
      {trimmedCode ? (
        <div className="booth-qr-preview-wrap">
          <canvas ref={canvasRef} className="booth-qr-preview" aria-label="Generated QR code preview" />
          <p className="admin-muted booth-qr-value">{trimmedCode}</p>
          {error && <p className="admin-muted booth-qr-error">{error}</p>}
          <button
            type="button"
            className="primary"
            onClick={downloadPng}
            disabled={Boolean(error) || loadingSignedToken}
          >
            Download PNG
          </button>
        </div>
      ) : (
        <p className="admin-muted">
          {useSignedQr
            ? 'Select a booth to generate a signed printable QR code.'
            : 'Enter a QR code in the booth form to generate a printable code.'}
        </p>
      )}
    </div>
  )
}
