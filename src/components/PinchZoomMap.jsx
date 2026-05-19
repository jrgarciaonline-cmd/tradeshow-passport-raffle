import { useEffect, useRef, useState } from 'react'

const MAP_SRC = '/maps/asla_map.PNG'
const MAP_WIDTH = 1600
const MAP_HEIGHT = 700
const MIN_SCALE = 1
const MAX_SCALE = 3.2
const FOCUS_SCALE = 2.35
const INITIAL_VIEW = { scale: 1, x: 0, y: 0 }

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

function getBounds(container, scale) {
  const width = MAP_WIDTH * scale
  const height = MAP_HEIGHT * scale
  const minX = Math.min(0, container.width - width)
  const minY = Math.min(0, container.height - height)

  return {
    minX,
    minY,
    maxX: 0,
    maxY: 0,
  }
}

function constrainView(view, container) {
  const bounds = getBounds(container, view.scale)

  return {
    scale: view.scale,
    x: clamp(view.x, bounds.minX, bounds.maxX),
    y: clamp(view.y, bounds.minY, bounds.maxY),
  }
}

export function PinchZoomMap({
  booths,
  completedIds,
  onPlaceBooth,
  placementBoothId = '',
  focusBoothId = '',
  className = '',
  title = '',
}) {
  const viewportRef = useRef(null)
  const pointers = useRef(new Map())
  const gestureStart = useRef(null)
  const viewRef = useRef(INITIAL_VIEW)
  const frameRef = useRef(null)
  const movedDuringGesture = useRef(false)
  const [view, setView] = useState(INITIAL_VIEW)
  const [selectedBoothId, setSelectedBoothId] = useState(null)

  const updateView = (nextView) => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)

    frameRef.current = requestAnimationFrame(() => {
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return

      const constrained = constrainView(nextView, rect)
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

  useEffect(() => {
    if (!focusBoothId) return

    const booth = booths.find((item) => item.id === focusBoothId)
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!booth || !rect) return

    const scale = FOCUS_SCALE
    const mapX = (booth.map.x / 100) * MAP_WIDTH
    const mapY = (booth.map.y / 100) * MAP_HEIGHT
    const focusedView = constrainView(
      {
        scale,
        x: rect.width / 2 - mapX * scale,
        y: rect.height / 2 - mapY * scale,
      },
      rect,
    )

    viewRef.current = focusedView
    setView(focusedView)
  }, [booths, focusBoothId])

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
          movedDuringGesture.current = true

          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          })

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
            const nextScale = clamp(
              start.view.scale * (distance(points[0], points[1]) / start.distance),
              MIN_SCALE,
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
        onPointerUp={(event) => endPointer(event.pointerId, event.currentTarget)}
        onPointerCancel={(event) =>
          endPointer(event.pointerId, event.currentTarget)
        }
      >
        <div
          className="pinch-map-area"
          style={{
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
          }}
          onClick={(event) => {
            if (!placementBoothId || movedDuringGesture.current) return

            const rect = viewportRef.current?.getBoundingClientRect()
            if (!rect) return

            const imageX =
              (event.clientX - rect.left - viewRef.current.x) /
              viewRef.current.scale
            const imageY =
              (event.clientY - rect.top - viewRef.current.y) /
              viewRef.current.scale

            onPlaceBooth?.(placementBoothId, {
              x: clamp((imageX / MAP_WIDTH) * 100, 0, 100),
              y: clamp((imageY / MAP_HEIGHT) * 100, 0, 100),
            })
          }}
        >
          <img src={MAP_SRC} alt="Expo floor map" />
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
                  if (placementBoothId) return
                  setSelectedBoothId(booth.id)
                }}
              >
                <span>{completed ? '✓' : ''}</span>
              </button>
            )
          })}
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
                  <h3>{booth.name}</h3>
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
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
