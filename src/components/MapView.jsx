import { PinchZoomMap } from './PinchZoomMap'

export function MapView({
  booths,
  completedIds,
  focusBoothId,
  onClearFocus,
  onScanBooth,
}) {
  const focusedBooth = booths.find((booth) => booth.id === focusBoothId)

  return (
    <section className="map-panel">
      <div className="map-heading">
        <div className="map-title-row">
          <h2>ASLA Expo Floor</h2>
          {focusedBooth && (
            <button type="button" onClick={onClearFocus}>
              Clear Selection
            </button>
          )}
        </div>
        {focusedBooth && (
          <p className="map-focus-note">
            Showing {focusedBooth.name} / {focusedBooth.location}
          </p>
        )}
      </div>
      <PinchZoomMap
        booths={booths}
        completedIds={completedIds}
        focusBoothId={focusBoothId}
        onScanBooth={onScanBooth}
        className="full-map-card"
      />
    </section>
  )
}
