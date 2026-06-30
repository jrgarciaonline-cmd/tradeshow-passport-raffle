import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { normalizeBarcodeForLookup } from '../services/normalizeBarcode'

export function BadgeScanPanel({ onScan, disabled = false }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(document.createElement('canvas'))
  const streamRef = useRef(null)
  const [manualCode, setManualCode] = useState('')
  const [message, setMessage] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

  const submitCode = useCallback(
    (code) => {
      const normalized = normalizeBarcodeForLookup(code)
      if (!normalized || disabled) return
      stopCamera()
      onScan(normalized)
    },
    [disabled, onScan, stopCamera],
  )

  const startCamera = async () => {
    if (disabled) return

    const isSecure = window.isSecureContext
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname)

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage(
        'Camera is not supported by this browser. Use manual badge code entry instead.',
      )
      return
    }

    if (!isSecure && !isLocal) {
      setMessage(
        'Camera access requires HTTPS or localhost. Use manual badge code entry instead.',
      )
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        await videoRef.current.play()
      }
      setCameraActive(true)
      setMessage('Point your camera at the QR code on your badge.')
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        setMessage('Camera permission was not granted. Enter the badge code manually.')
      } else if (error.name === 'NotFoundError') {
        setMessage('No camera was found on this device. Enter the badge code manually.')
      } else {
        setMessage(
          `Unable to access the camera: ${error.message || error}. Enter the badge code manually.`,
        )
      }
    }
  }

  useEffect(() => {
    if (!cameraActive || disabled) return undefined

    const detector = 'BarcodeDetector' in window
      ? new window.BarcodeDetector({ formats: ['qr_code'] })
      : null
    let cancelled = false

    const detect = async () => {
      if (!videoRef.current || cancelled) return
      if (videoRef.current.readyState < 2) {
        window.setTimeout(detect, 300)
        return
      }

      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) {
        window.setTimeout(detect, 300)
        return
      }

      const width = videoRef.current.videoWidth
      const height = videoRef.current.videoHeight
      if (!width || !height) {
        window.setTimeout(detect, 300)
        return
      }

      canvas.width = width
      canvas.height = height
      context.drawImage(videoRef.current, 0, 0, width, height)

      if (detector) {
        try {
          const codes = await detector.detect(canvas)
          if (codes[0]?.rawValue) {
            submitCode(codes[0].rawValue)
            return
          }
        } catch {
          setMessage('Scanner paused. Enter the badge code manually if needed.')
        }
      } else {
        try {
          const imageData = context.getImageData(0, 0, width, height)
          const qrCode = jsQR(imageData.data, width, height, {
            inversionAttempts: 'attemptBoth',
          })
          if (qrCode?.data) {
            submitCode(qrCode.data)
            return
          }
        } catch {
          setMessage('Scanner paused. Enter the badge code manually if needed.')
        }
      }

      window.setTimeout(detect, 700)
    }

    detect()
    return () => {
      cancelled = true
    }
  }, [cameraActive, disabled, submitCode])

  useEffect(() => stopCamera, [stopCamera])

  return (
    <div className="badge-scan-panel">
      <div className="scan-frame badge-scan-frame">
        <video
          ref={videoRef}
          className={`scanner-video ${cameraActive ? '' : 'is-hidden'}`}
          muted
          playsInline
        />
        {!cameraActive ? (
          <div className="scan-start-prompt">
            <span aria-hidden="true">▣</span>
            <strong>Scan Your Badge</strong>
            <small>Tap below to open the camera and scan the QR code on your badge</small>
            <div aria-hidden="true">↓</div>
          </div>
        ) : (
          <div className="scan-corners" aria-hidden="true" />
        )}
      </div>

      <div className="scanner-controls">
        <button
          type="button"
          className="primary"
          disabled={disabled}
          onClick={cameraActive ? stopCamera : startCamera}
        >
          {cameraActive ? 'Stop Camera' : 'Start Camera'}
        </button>
        <button
          type="button"
          className="manual-scan-toggle"
          aria-expanded={manualOpen}
          onClick={() => setManualOpen((current) => !current)}
        >
          <span>Enter Badge Code Manually</span>
          <small>{manualOpen ? 'Hide entry' : 'If the QR code will not scan'}</small>
        </button>
        {manualOpen && (
          <form
            className="manual-scan"
            onSubmit={(event) => {
              event.preventDefault()
              submitCode(manualCode)
            }}
          >
            <label className="form-field">
              <span>Badge QR data</span>
              <input
                value={manualCode}
                disabled={disabled}
                onChange={(event) => setManualCode(event.target.value)}
                placeholder="Paste or type badge QR data"
              />
            </label>
            <button type="submit" disabled={disabled || !manualCode.trim()}>
              Look Up Badge
            </button>
          </form>
        )}
      </div>

      {message && <p className="status-note">{message}</p>}
    </div>
  )
}
