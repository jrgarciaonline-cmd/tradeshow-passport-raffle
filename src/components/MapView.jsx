import { PinchZoomMap } from './PinchZoomMap'

export function MapView({ booths, completedIds, focusBoothId }) {
  return (
    <section className="map-panel">
      <div>
        <h2>ASLA Expo Floor</h2>
      </div>
      <PinchZoomMap
        booths={booths}
        completedIds={completedIds}
        focusBoothId={focusBoothId}
        className="full-map-card"
      />
    </section>
  )
}
