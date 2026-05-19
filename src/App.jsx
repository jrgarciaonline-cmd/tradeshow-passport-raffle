import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { boothCategories, defaultInstructions } from './data/mockData'
import { usePassportStore } from './services/usePassportStore'
import { AdminPanel } from './components/AdminPanel'
import { AuthScreen } from './components/AuthScreen'
import { BoothCard } from './components/BoothCard'
import { MapView } from './components/MapView'
import { PassportSummary } from './components/PassportSummary'
import { RaffleForm } from './components/RaffleForm'
import { ScannerPanel } from './components/ScannerPanel'

const attendeeTabs = [
  { id: 'Home', icon: '▮' },
  { id: 'Booths', icon: '◆' },
  { id: 'Map', icon: '▦' },
  { id: 'Instructions', icon: '●' },
  { id: 'QR Scanner', icon: '▣' },
]

function App() {
  const store = usePassportStore()
  const [mode, setMode] = useState('attendee')
  const [authView, setAuthView] = useState('signup')
  const [activeTab, setActiveTab] = useState('Home')
  const [challengeView, setChallengeView] = useState('Active')
  const [focusedBoothId, setFocusedBoothId] = useState('')
  const [scannedBoothId, setScannedBoothId] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')

  const instructions = store.settings?.instructions?.length
    ? store.settings.instructions
    : defaultInstructions

  const filteredBooths = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return store.booths.filter((booth) => {
      const matchesCategory = category === 'All' || booth.category === category
      const matchesQuery =
        !normalizedQuery ||
        [booth.name, booth.location, booth.description, booth.category]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)

      return matchesCategory && matchesQuery
    })
  }, [category, query, store.booths])

  const completedBooths = filteredBooths.filter((booth) =>
    store.completedIds.includes(booth.id),
  )
  const activeBooths = filteredBooths.filter(
    (booth) => !store.completedIds.includes(booth.id),
  )
  const visibleBooths =
    challengeView === 'Completed' ? completedBooths : activeBooths
  const activeMode = store.session?.type === 'admin' ? 'admin' : mode

  const handleScan = (code) => {
    const result = store.checkInByCode(code)
    if (result.ok && result.id) {
      setScannedBoothId(result.id)
      setFocusedBoothId(result.id)
    }
    return result
  }

  useEffect(() => {
    if (!scannedBoothId) return undefined

    const timer = window.setTimeout(() => {
      setScannedBoothId('')
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [scannedBoothId])

  return (
    <main className="app-stage">
      <section
        className={`phone-shell ${
          store.session?.type === 'attendee' && activeMode === 'attendee'
            ? ''
            : 'no-bottom-nav'
        }`}
        aria-label="Trade show passport app"
      >
        <header className="app-bar">
          <button
            type="button"
            className="icon-button"
            aria-label={
              activeMode === 'admin' ? 'Back to sign in' : 'Open admin'
            }
            onClick={() => {
              if (activeMode === 'admin') {
                store.signOut()
                setAuthView('signin')
                return
              }

              if (store.session?.type === 'admin') {
                setMode('admin')
                return
              }

              store.signOut()
              setAuthView('admin')
            }}
          >
            {activeMode === 'admin' ? '‹' : '⚙'}
          </button>
          <strong>Land F/X Passport Raffle</strong>
          <button
            type="button"
            className="icon-button"
            aria-label="Sign out"
            onClick={() => {
              store.signOut()
              setAuthView('signin')
            }}
          >
            ⎋
          </button>
        </header>

        <div className="app-content">
          {!store.session && (
            <AuthScreen
              key={authView}
              initialView={authView}
              onRegister={store.registerAttendee}
              onSignIn={store.signInAttendee}
              onAdminSignIn={store.signInAdmin}
            />
          )}

          {store.session && activeMode === 'attendee' && activeTab === 'Home' && (
            <>
              <PassportSummary
                attendeeName={store.currentAttendee?.name}
                completedIds={store.completedIds}
                requiredScanCount={store.requiredScanCount}
              />

              {store.passportComplete && (
                <section className="celebration-panel">
                  <div className="burst" aria-hidden="true">
                    ✓
                  </div>
                  <div>
                    <p className="eyebrow">Passport Complete</p>
                    <h2>Raffle unlocked</h2>
                    <p>Submit your contact details to enter the drawing.</p>
                  </div>
                </section>
              )}

              <RaffleForm
                disabled={!store.passportComplete}
                onSubmit={store.submitEntry}
                latestEntry={store.entries.at(-1)}
              />
            </>
          )}

          {store.session && activeMode === 'attendee' && activeTab === 'Booths' && (
            <section className="content-stack">
              <div className="segmented-control" aria-label="Booth status">
                {['Active', 'Completed'].map((view) => (
                  <button
                    type="button"
                    key={view}
                    className={challengeView === view ? 'active' : ''}
                    onClick={() => setChallengeView(view)}
                  >
                    {view}
                  </button>
                ))}
              </div>

              <div className="filter-row">
                <label className="search-field">
                  <span>Search</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Manufacturer or booth"
                  />
                </label>
                <label className="select-field">
                  <span>Filter</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    {boothCategories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="challenge-list">
                {visibleBooths.map((booth) => (
                  <BoothCard
                    key={booth.id}
                    booth={booth}
                    completed={store.completedIds.includes(booth.id)}
                    highlighted={scannedBoothId === booth.id}
                    onShowOnMap={(boothId) => {
                      setFocusedBoothId(boothId)
                      setActiveTab('Map')
                    }}
                  />
                ))}
                {!visibleBooths.length && (
                  <p className="empty-state">No manufacturers match this view.</p>
                )}
              </div>
            </section>
          )}

          {store.session && activeMode === 'attendee' && activeTab === 'Map' && (
            <MapView
              booths={store.booths}
              completedIds={store.completedIds}
              focusBoothId={focusedBoothId}
            />
          )}

          {store.session &&
            activeMode === 'attendee' &&
            activeTab === 'Instructions' && (
            <section className="instructions-screen">
              <h2>How to play</h2>
              {instructions.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </section>
          )}

          {store.session &&
            activeMode === 'attendee' &&
            activeTab === 'QR Scanner' && (
            <ScannerPanel booths={store.booths} onScan={handleScan} />
          )}

          {store.session?.type === 'admin' && activeMode === 'admin' && (
            <AdminPanel
              booths={store.booths}
              entries={store.entries}
              onSaveBooth={store.saveBooth}
              onDeleteBooth={store.deleteBooth}
              onPlaceBooth={store.placeBoothOnMap}
              settings={store.settings}
              onSaveSettings={store.saveSettings}
              onExportCsv={store.exportEntriesCsv}
              onResetDemo={store.resetDemo}
            />
          )}
        </div>

        {store.session?.type === 'attendee' && activeMode === 'attendee' && (
          <nav className="bottom-nav" aria-label="Attendee views">
            {attendeeTabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={activeTab === tab.id ? 'active' : ''}
                onClick={() => setActiveTab(tab.id)}
              >
                <span aria-hidden="true">{tab.icon}</span>
                {tab.id}
              </button>
            ))}
          </nav>
        )}
      </section>
    </main>
  )
}

export default App
