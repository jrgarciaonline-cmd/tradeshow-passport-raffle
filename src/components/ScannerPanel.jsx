import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { getBoothLogoFrameStyle } from '../utils/boothLogoStyles'

const CAMERA_GRANTED_KEY = 'passport-camera-granted'

export function ScannerPanel({ onScan, onGoHome, onGoMap }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(document.createElement('canvas'))
  const streamRef = useRef(null)
  const [manualCode, setManualCode] = useState('')
  const [message, setMessage] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [scanSuccess, setScanSuccess] = useState(false)
  const [duplicateScan, setDuplicateScan] = useState(false)
  const [scannedBooth, setScannedBooth] = useState(null)
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
      const result = onScan(code)
      setMessage(result.message)
      if (result.ok) {
        setManualCode('')
        setScannedBooth(result.booth ?? null)
        setScanSuccess(true)
        setDuplicateScan(false)
      } else if (result.duplicate) {
        setManualCode('')
        setScannedBooth(result.booth ?? null)
        setScanSuccess(false)
        setDuplicateScan(true)
      } else {
        setScanSuccess(false)
        setDuplicateScan(false)
      }
    },
    [onScan],
  )

  const startCamera = useCallback(async () => {
    setScanSuccess(false)
    setDuplicateScan(false)
    setScannedBooth(null)
    const isSecure = window.isSecureContext
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname)

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage(
        'Camera is not supported by this browser. ' +
          (isSecure || isLocal
            ? 'Try a different browser or upgrade iOS.'
            : 'Safari on iPhone requires HTTPS or localhost to access the camera.')
      )
      return
    }

    if (!isSecure && !isLocal) {
      setMessage(
        'Camera access may be blocked because this page is not secure. ' +
          'Use HTTPS, localhost, or a secure tunnel, or use manual code entry.'
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
      sessionStorage.setItem(CAMERA_GRANTED_KEY, '1')
      setMessage(
        'Camera ready. Point it at a partner QR code. ' +
          ('BarcodeDetector' in window
            ? 'Using native QR detection.'
            : 'Using fallback scanner.')
      )
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        sessionStorage.removeItem(CAMERA_GRANTED_KEY)
        setMessage('Camera permission was not granted.')
      } else if (error.name === 'NotFoundError') {
        setMessage('No camera was found on this device.')
      } else {
        setMessage(
          `Unable to access the camera: ${error.message || error}. ` +
            'Try manual entry or open over HTTPS.'
        )
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const tryAutoStart = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return

      let mayAutoStart = sessionStorage.getItem(CAMERA_GRANTED_KEY) === '1'

      if (!mayAutoStart && navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({ name: 'camera' })
          mayAutoStart = status.state === 'granted'
        } catch {
          // Permissions API unavailable — rely on session flag only
        }
      }

      if (!cancelled && mayAutoStart) {
        startCamera()
      }
    }

    tryAutoStart()

    return () => {
      cancelled = true
    }
  }, [startCamera])

  useEffect(() => {
    if (!cameraActive) return undefined

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
            stopCamera()
            return
          }
        } catch {
          setMessage('Scanner paused. Try manual entry if the QR is not found.')
        }
      } else {
        try {
          const imageData = context.getImageData(0, 0, width, height)
          const qrCode = jsQR(imageData.data, width, height, {
            inversionAttempts: 'attemptBoth',
          })
          if (qrCode?.data) {
            submitCode(qrCode.data)
            stopCamera()
            return
          }
        } catch {
          setMessage('Scanner paused. Try manual entry if the QR is not found.')
        }
      }

      window.setTimeout(detect, 700)
    }

    detect()
    return () => {
      cancelled = true
    }
  }, [cameraActive, stopCamera, submitCode])

  useEffect(() => stopCamera, [stopCamera])

  return (
    <section className="scanner-panel">
      <div>
        <h2>Please scan the QR Code</h2>
      </div>
      <button
        type="button"
        className="scanner-home-button"
        onClick={onGoHome}
      >
        Go to Home to check progress
      </button>
      <div className="scan-frame">
        <video
          ref={videoRef}
          className={`scanner-video ${
            scanSuccess || duplicateScan ? 'is-hidden' : ''
          }`}
          muted
          playsInline
        />
        {duplicateScan ? (
          <div className="scan-duplicate" aria-live="polite">
            <div className="scan-duplicate-orbit" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div
              className="scan-success-logo duplicate"
              style={scannedBooth ? getBoothLogoFrameStyle(scannedBooth) : undefined}
            >
              {scannedBooth?.logoDataUrl ? (
                <img src={scannedBooth.logoDataUrl} alt="" />
              ) : (
                <span>{scannedBooth?.name?.slice(0, 1) ?? '!'}</span>
              )}
            </div>
            <strong>{scannedBooth?.name ?? 'This expo booth'} has already been scanned</strong>
            <small>Head to the map to find another booth stop.</small>
            <button type="button" onClick={onGoMap}>
              Go to Map
            </button>
          </div>
        ) : scanSuccess ? (
          <div className="scan-success" aria-live="polite">
            <div
              className="scan-success-logo"
              style={scannedBooth ? getBoothLogoFrameStyle(scannedBooth) : undefined}
            >
              {scannedBooth?.logoDataUrl ? (
                <img src={scannedBooth.logoDataUrl} alt="" />
              ) : (
                <span>{scannedBooth?.name?.slice(0, 1) ?? '✓'}</span>
              )}
            </div>
            <span>✓</span>
            <strong>{scannedBooth?.name ?? 'Booth'} scanned</strong>
          </div>
        ) : !cameraActive ? (
          <div className="scan-start-prompt">
            <span aria-hidden="true">▣</span>
            <strong>Start Camera</strong>
            <small>Tap the button below to scan a booth QR code</small>
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
          <span>Manual QR Code</span>
          <small>{manualOpen ? 'Hide entry' : 'Tap to enter a code'}</small>
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
              <span>Manual QR code</span>
              <input
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                placeholder="Enter manual scan code"
              />
            </label>
            <button type="submit">Enter Code</button>
          </form>
        )}
      </div>
      {message && <p className="status-note">{message}</p>}
    </section>
  )
}
