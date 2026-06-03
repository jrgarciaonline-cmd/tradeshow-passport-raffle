import { useEffect, useRef, useState } from 'react'
import { MapMarkerLogo } from './MapMarkerLogo'

const DEFAULT_MAP_SRC = '/maps/asla_map.PNG'
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

function formatBoothLocation(location) {
  const match = String(location ?? '').match(/\d[\dA-Za-z-]*/)
  return match?.[0] ?? location
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
  onBoothSelect,
  placementBoothId = '',
  focusBoothId = '',
  focusKey = 0,
  onFocusHandled,
  locationBoothId = '',
  mapLocked = false,
  className = '',
  title = '',
  mapSrc = DEFAULT_MAP_SRC,
}) {
  const viewportRef = useRef(null)
  const pointers = useRef(new Map())
  const gestureStart = useRef(null)
  const viewRef = useRef(INITIAL_VIEW)
  const frameRef = useRef(null)
  const movedDuringGesture = useRef(false)
  const pointerStart = useRef(null)
  const lastFocusedBoothId = useRef('')
  const focusBoothIdRef = useRef(focusBoothId)
  const pendingFocus = useRef(null)
  const hasPositionedView = useRef(false)
  const [view, setView] = useState(INITIAL_VIEW)
  const [mapSize, setMapSize] = useState(INITIAL_MAP_SIZE)

  const updateView = (nextView) => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)

    frameRef.current = requestAnimationFrame(() => {
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return

      const constrained = constrainView(nextView, rect, mapSize)
      hasPositionedView.current = true
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

  const endPointer = (pointerId) => {
    pointers.current.delete(pointerId)
    if (!pointers.current.size) {
      gestureStart.current = null
      return
    }
    const viewport = viewportRef.current
    if (viewport) startGesture(viewport)
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

  const zoomAtPoint = (clientX, clientY, nextScale) => {
    pendingFocus.current = null
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    const currentView = viewRef.current
    const scale = clamp(nextScale, getFitScale(rect, mapSize), MAX_SCALE)
    const anchorX = clientX - rect.left
    const anchorY = clientY - rect.top
    const mapX = (anchorX - currentView.x) / currentView.scale
    const mapY = (anchorY - currentView.y) / currentView.scale

    updateView({
      scale,
      x: anchorX - mapX * scale,
      y: anchorY - mapY * scale,
    })
  }

  const zoomFromCenter = (factor) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    zoomAtPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      viewRef.current.scale * factor,
    )
  }

  const resetView = () => {
    pendingFocus.current = null
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    updateView({
      scale: getFitScale(rect, mapSize),
      x: 0,
      y: 0,
    })
  }

  const handleSurfacePointerDown = (event) => {
    if (mapLocked) return

    movedDuringGesture.current = false
    pointerStart.current = { x: event.clientX, y: event.clientY }
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    startGesture(viewportRef.current)
  }

  const handleSurfacePointerMove = (event) => {
    if (mapLocked || !pointers.current.has(event.pointerId)) return

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
  }

  const handleSurfacePointerUp = (event) => {
    if (
      placementBoothId &&
      pointers.current.size === 1 &&
      pointers.current.has(event.pointerId) &&
      !movedDuringGesture.current
    ) {
      placeBoothAtPoint(event.clientX, event.clientY)
    }
    endPointer(event.pointerId)
  }

  useEffect(() => {
    focusBoothIdRef.current = focusBoothId
    if (focusBoothId) {
      pendingFocus.current = { boothId: focusBoothId, key: focusKey }
    }
  }, [focusBoothId, focusKey])

  useEffect(() => {
    if (focusBoothIdRef.current || hasPositionedView.current) return

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

    hasPositionedView.current = true
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
    if (focusBoothId) {
      pendingFocus.current = { boothId: focusBoothId, key: focusKey }
    }

    const focusRequest = pendingFocus.current
    if (!focusRequest?.boothId) return

    const focusRequestId = `${focusRequest.boothId}:${focusRequest.key}:${mapSize.width}x${mapSize.height}`
    if (lastFocusedBoothId.current === focusRequestId) return

    const frame = requestAnimationFrame(() => {
      const booth = booths.find((item) => item.id === focusRequest.boothId)
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

      hasPositionedView.current = true
      viewRef.current = focusedView
      setView(focusedView)
      lastFocusedBoothId.current = focusRequestId
      onFocusHandled?.()
    })

    return () => cancelAnimationFrame(frame)
  }, [booths, focusBoothId, focusKey, mapSize, onFocusHandled])

  return (
    <div className={`pinch-map ${mapLocked ? 'is-locked' : ''} ${className}`}>
      <div className="pinch-map-header">
        {title && <strong>{title}</strong>}
        <span>{placementBoothId ? 'Tap map to place' : 'Pinch or drag'}</span>
        <div className="map-zoom-controls" aria-label="Map zoom controls">
          <button type="button" onClick={() => zoomFromCenter(1.22)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoomFromCenter(0.82)} aria-label="Zoom out">
            -
          </button>
          <button type="button" onClick={resetView} aria-label="Reset map zoom">
            Reset
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className="pinch-map-scroll"
        onWheel={(event) => {
          if (mapLocked) return
          event.preventDefault()
          pendingFocus.current = null
          const delta = -event.deltaY
          const factor = delta > 0 ? 1.14 : 0.88
          zoomAtPoint(event.clientX, event.clientY, viewRef.current.scale * factor)
        }}
      >
        <div
          className="pinch-map-area"
          style={{
            width: `${mapSize.width}px`,
            height: `${mapSize.height}px`,
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
          }}
        >
          <div
            className="pinch-map-surface"
            onPointerDown={handleSurfacePointerDown}
            onPointerMove={handleSurfacePointerMove}
            onPointerUp={handleSurfacePointerUp}
            onPointerCancel={handleSurfacePointerUp}
          >
            <img
              key={mapSrc}
              src={mapSrc}
              alt="Expo floor map"
              draggable={false}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget
                if (!naturalWidth || !naturalHeight) return

                setMapSize({
                  width: BASE_MAP_WIDTH,
                  height: Math.round(BASE_MAP_WIDTH * (naturalHeight / naturalWidth)),
                })
              }}
            />
          </div>
          <div className="pinch-map-pins" aria-hidden={mapLocked}>
            {booths.map((booth) => {
              const completed = completedIds.includes(booth.id)
              const selected = placementBoothId === booth.id
              const locationLabel = formatBoothLocation(booth.location)

              return (
                <button
                  type="button"
                  className={`pinch-map-pin ${completed ? 'complete' : ''} ${
                    selected ? 'selected' : ''
                  }`}
                  key={booth.id}
                  style={{
                    '--x': `${booth.map.x}%`,
                    '--y': `${booth.map.y}%`,
                    '--pin-color': booth.color,
                  }}
                  title={`${booth.name} / ${booth.location}`}
                  aria-label={`${booth.name}, ${booth.location}`}
                  disabled={mapLocked}
                  onClick={() => {
                    if (placementBoothId || mapLocked) return
                    onBoothSelect?.(booth.id)
                  }}
                >
                  <span className="map-marker-pin">
                    <span className="map-marker-location">{locationLabel}</span>
                  </span>
                  <span className="map-marker-banner">
                    {booth.logoDataUrl ? (
                      <MapMarkerLogo src={booth.logoDataUrl} alt="" />
                    ) : (
                      <strong>{booth.name}</strong>
                    )}
                  </span>
                  {completed && <span className="map-marker-check">✓</span>}
                </button>
              )
            })}
          </div>
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
      </div>
    </div>
  )
}
