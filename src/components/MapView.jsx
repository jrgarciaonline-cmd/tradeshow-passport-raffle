import { PinchZoomMap } from './PinchZoomMap'

export function MapView({
  booths,
  completedIds,
  selectedBoothId,
  focusBoothId,
  focusKey,
  locationBoothId,
  mapSrc,
  onFocusHandled,
  onClearFocus,
  onScanBooth,
}) {
  const selectedBooth = booths.find((booth) => booth.id === selectedBoothId)

  return (
    <section className="map-panel">
      <div className="map-heading">
        <div className="map-title-row">
          <h2>ASLA Expo Floor</h2>
          {selectedBooth && (
            <button type="button" onClick={onClearFocus}>
              Clear Selection
            </button>
          )}
        </div>
        {selectedBooth && (
          <p className="map-focus-note">
            Showing {selectedBooth.name} / {selectedBooth.location}
          </p>
        )}
      </div>
      <PinchZoomMap
        booths={booths}
        completedIds={completedIds}
        focusBoothId={focusBoothId}
        focusKey={focusKey}
        locationBoothId={locationBoothId}
        onScanBooth={onScanBooth}
        onFocusHandled={onFocusHandled}
        mapSrc={mapSrc}
        className="full-map-card"
      />
    </section>
  )
}
