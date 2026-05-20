import { useEffect, useRef, useState } from 'react'

const MAP_SRC = '/maps/asla_map.PNG'
const BASE_MAP_WIDTH = 1600
const DEFAULT_MAP_RATIO = 2059 / 3000
const MAX_SCALE = 3.2
const MIN_FOCUS_SCALE = 0.9
const MAX_FOCUS_SCALE = 1.55
const INITIAL_VIEW = { scale: 0.25, x: 0, y: 0 }
const INITIAL_MAP_SIZE = {
  width: BASE_MAP_WIDTH,
  height: Math.round(BASE_MAP_WIDTH * DEFAULT_MAP_RATIO),
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function midpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  }
}

function getBounds(container, scale, mapSize) {
  const width = mapSize.width * scale
  const height = mapSize.height * scale
  const minX = width <= container.width ? (container.width - width) / 2 : container.width - width
  const minY = height <= container.height ? (container.height - height) / 2 : container.height - height
  const maxX = width <= container.width ? minX : 0
  const maxY = height <= container.height ? minY : 0

  return {
    minX,
    minY,
    maxX,
    maxY,
  }
}

function getFitScale(container, mapSize) {
  return Math.min(container.width / mapSize.width, container.height / mapSize.height, 1)
}

function constrainView(view, container, mapSize) {
  const minScale = getFitScale(container, mapSize)
  const scale = clamp(view.scale, minScale, MAX_SCALE)
  const bounds = getBounds(container, scale, mapSize)

  return {
    scale,
    x: clamp(view.x, bounds.minX, bounds.maxX),
    y: clamp(view.y, bounds.minY, bounds.maxY),
  }
}

export function PinchZoomMap({
  booths,
  completedIds,
  onPlaceBooth,
  onScanBooth,
  placementBoothId = '',
  focusBoothId = '',
  focusKey = 0,
  locationBoothId = '',
  className = '',
  title = '',
}) {
  const viewportRef = useRef(null)
  const pointers = useRef(new Map())
  const gestureStart = useRef(null)
  const viewRef = useRef(INITIAL_VIEW)
  const frameRef = useRef(null)
  const movedDuringGesture = useRef(false)
  const pointerStart = useRef(null)
  const lastFocusedBoothId = useRef('')
  const [view, setView] = useState(INITIAL_VIEW)
  const [mapSize, setMapSize] = useState(INITIAL_MAP_SIZE)
  const [selectedBoothId, setSelectedBoothId] = useState(null)

  const updateView = (nextView) => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)

    frameRef.current = requestAnimationFrame(() => {
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return

      const constrained = constrainView(nextView, rect, mapSize)
      viewRef.current = constrained
      setView(constrained)
    })
  }

  const startGesture = (target) => {
    const points = [...pointers.current.values()]

    if (points.length === 1) {
      gestureStart.current = {
        mode: 'pan',
        point: points[0],
        view: viewRef.current,
      }
      return
    }

    if (points.length === 2) {
      const rect = target.getBoundingClientRect()
      const center = midpoint(points[0], points[1])

      gestureStart.current = {
        mode: 'pinch',
        distance: distance(points[0], points[1]),
        midpoint: center,
        view: viewRef.current,
        rect,
      }
    }
  }

  const endPointer = (pointerId, target) => {
    pointers.current.delete(pointerId)
    startGesture(target)
  }

  const placeBoothAtPoint = (clientX, clientY) => {
    if (!placementBoothId || movedDuringGesture.current) return

    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    const imageX = (clientX - rect.left - viewRef.current.x) / viewRef.current.scale
    const imageY = (clientY - rect.top - viewRef.current.y) / viewRef.current.scale

    onPlaceBooth?.(placementBoothId, {
      x: clamp((imageX / mapSize.width) * 100, 0, 100),
      y: clamp((imageY / mapSize.height) * 100, 0, 100),
    })
  }

  useEffect(() => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    const fittedView = constrainView(
      {
        scale: getFitScale(rect, mapSize),
        x: 0,
        y: 0,
      },
      rect,
      mapSize,
    )

    viewRef.current = fittedView
    setView(fittedView)
  }, [mapSize])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return undefined

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return
      const rect = entry.contentRect
      const nextView = constrainView(viewRef.current, rect, mapSize)
      viewRef.current = nextView
      setView(nextView)
    })

    resizeObserver.observe(viewport)
    return () => resizeObserver.disconnect()
  }, [mapSize])

  useEffect(() => {
    if (!focusBoothId) {
      lastFocusedBoothId.current = ''
      return
    }

    const focusRequestId = `${focusBoothId}:${focusKey}`
    if (lastFocusedBoothId.current === focusRequestId) return

    const frame = requestAnimationFrame(() => {
      const booth = booths.find((item) => item.id === focusBoothId)
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!booth || !rect) return

      const fitScale = getFitScale(rect, mapSize)
      const scale = clamp(
        Math.max(fitScale * 2.4, MIN_FOCUS_SCALE),
        fitScale,
        MAX_FOCUS_SCALE,
      )
      const mapX = (booth.map.x / 100) * mapSize.width
      const mapY = (booth.map.y / 100) * mapSize.height
      const focusedView = constrainView(
        {
          scale,
          x: rect.width / 2 - mapX * scale,
          y: rect.height / 2 - mapY * scale,
        },
        rect,
        mapSize,
      )

      viewRef.current = focusedView
      setView(focusedView)
      lastFocusedBoothId.current = focusRequestId
    })

    return () => cancelAnimationFrame(frame)
  }, [booths, focusBoothId, focusKey, mapSize])

  return (
    <div className={`pinch-map ${className}`}>
      <div className="pinch-map-header">
        {title && <strong>{title}</strong>}
        <span>{placementBoothId ? 'Tap map to place' : 'Pinch or drag'}</span>
      </div>
      <div
        ref={viewportRef}
        className="pinch-map-scroll"
        onPointerDown={(event) => {
          event.preventDefault()
          movedDuringGesture.current = false
          pointerStart.current = { x: event.clientX, y: event.clientY }
          event.currentTarget.setPointerCapture(event.pointerId)
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          })
          startGesture(event.currentTarget)
        }}
        onPointerMove={(event) => {
          if (!pointers.current.has(event.pointerId)) return
          event.preventDefault()

          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          })

          if (pointerStart.current) {
            const movedDistance = Math.hypot(
              event.clientX - pointerStart.current.x,
              event.clientY - pointerStart.current.y,
            )
            movedDuringGesture.current = movedDistance > 6
          }

          const start = gestureStart.current
          if (!start) return

          const points = [...pointers.current.values()]

          if (start.mode === 'pan' && points.length === 1) {
            updateView({
              ...start.view,
              x: start.view.x + points[0].x - start.point.x,
              y: start.view.y + points[0].y - start.point.y,
            })
            return
          }

          if (start.mode === 'pinch' && points.length === 2) {
            const currentMidpoint = midpoint(points[0], points[1])
            const minScale = getFitScale(start.rect, mapSize)
            const nextScale = clamp(
              start.view.scale * (distance(points[0], points[1]) / start.distance),
              minScale,
              MAX_SCALE,
            )
            const startAnchorX = start.midpoint.x - start.rect.left
            const startAnchorY = start.midpoint.y - start.rect.top
            const currentAnchorX = currentMidpoint.x - start.rect.left
            const currentAnchorY = currentMidpoint.y - start.rect.top
            const mapX = (startAnchorX - start.view.x) / start.view.scale
            const mapY = (startAnchorY - start.view.y) / start.view.scale

            updateView({
              scale: nextScale,
              x: currentAnchorX - mapX * nextScale,
              y: currentAnchorY - mapY * nextScale,
            })
          }
        }}
        onPointerUp={(event) => {
          if (
            placementBoothId &&
            pointers.current.size === 1 &&
            pointers.current.has(event.pointerId) &&
            !movedDuringGesture.current
          ) {
            placeBoothAtPoint(event.clientX, event.clientY)
          }
          endPointer(event.pointerId, event.currentTarget)
        }}
        onPointerCancel={(event) =>
          endPointer(event.pointerId, event.currentTarget)
        }
      >
        <div
          className="pinch-map-area"
          style={{
            width: `${mapSize.width}px`,
            height: `${mapSize.height}px`,
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
          }}
        >
          <img
            src={MAP_SRC}
            alt="Expo floor map"
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget
              if (!naturalWidth || !naturalHeight) return

              setMapSize({
                width: BASE_MAP_WIDTH,
                height: Math.round(BASE_MAP_WIDTH * (naturalHeight / naturalWidth)),
              })
            }}
          />
          {booths.map((booth) => {
            const completed = completedIds.includes(booth.id)
            const selected = placementBoothId === booth.id

            return (
              <button
                type="button"
                className={`pinch-map-pin ${completed ? 'complete' : ''} ${
                  selected ? 'selected' : ''
                }`}
                key={booth.id}
                style={{ '--x': `${booth.map.x}%`, '--y': `${booth.map.y}%` }}
                title={`${booth.name} / ${booth.location}`}
                aria-label={`${booth.name}, ${booth.location}`}
                onClick={(e) => {
                  e.stopPropagation()
                  if (placementBoothId) {
                    return
                  }
                  setSelectedBoothId(booth.id)
                }}
              >
                <span>{completed ? '✓' : ''}</span>
              </button>
            )
          })}
          {(() => {
            const locationBooth = booths.find((booth) => booth.id === locationBoothId)
            if (!locationBooth) return null

            return (
              <div
                className="you-are-here-pin"
                style={{
                  '--x': `${locationBooth.map.x}%`,
                  '--y': `${locationBooth.map.y}%`,
                }}
              >
                <strong>Your last scanned location</strong>
                <span />
              </div>
            )
          })()}
        </div>
        {selectedBoothId && (
          <div
            className="booth-popup-overlay"
            onClick={() => setSelectedBoothId(null)}
          >
            {(() => {
              const booth = booths.find((b) => b.id === selectedBoothId)
              if (!booth) return null

              return (
                <div
                  className="booth-popup"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="booth-popup-close"
                    onClick={() => setSelectedBoothId(null)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                  <div className="booth-popup-logo">
                    {booth.logoDataUrl ? (
                      <img src={booth.logoDataUrl} alt="" />
                    ) : (
                      <span>{booth.name.slice(0, 1)}</span>
                    )}
                  </div>
                  <h3>{booth.name}</h3>
                  <div className="booth-popup-actions">
                    {booth.websiteUrl && (
                      <a
                        href={booth.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="booth-popup-button"
                      >
                        Visit Website
                      </a>
                    )}
                    <button
                      type="button"
                      className="booth-popup-button"
                      onClick={() => onScanBooth?.(booth.id)}
                    >
                      Scan QR Code
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
