import { BoothMapPopup } from './BoothMapPopup'
import { PinchZoomMap } from './PinchZoomMap'

export function MapView({
  booths,
  completedIds,
  selectedBoothId,
  focusBoothId,
  focusKey,
  locationBoothId,
  mapSrc,
  mapVersion = '',
  onFocusHandled,
  onBoothSelect,
  onClearFocus,
  onScanBooth,
}) {
  const selectedBooth = booths.find((booth) => booth.id === selectedBoothId) ?? null

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
      <div className="map-panel-map">
        <PinchZoomMap
          key={`${mapSrc ?? ''}:${mapVersion ?? ''}`}
          booths={booths}
          completedIds={completedIds}
          focusBoothId={focusBoothId}
          focusKey={focusKey}
          locationBoothId={locationBoothId}
          mapLocked={Boolean(selectedBoothId)}
          onBoothSelect={onBoothSelect}
          onFocusHandled={onFocusHandled}
          mapSrc={mapSrc}
          mapVersion={mapVersion}
          className="full-map-card"
        />
        <BoothMapPopup
          booth={selectedBooth}
          onClose={() => onBoothSelect?.('')}
          onScanBooth={onScanBooth}
        />
      </div>
    </section>
  )
}
