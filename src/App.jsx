import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { boothCategories, defaultInstructions } from './data/mockData'
import { usePassportStore } from './services/usePassportStore'
import { AdminDashboard } from './components/AdminDashboard'
import { AdminPanel } from './components/AdminPanel'
import { AuthScreen } from './components/AuthScreen'
import { BoothCard } from './components/BoothCard'
import { ConfettiOverlay } from './components/ConfettiOverlay'
import { MapView } from './components/MapView'
import { PassportSummary } from './components/PassportSummary'
import { RaffleEntryPanel } from './components/RaffleEntryPanel'
import { ScannerPanel } from './components/ScannerPanel'

const attendeeTabs = [
  { id: 'Home', icon: '▮' },
  { id: 'Instructions', icon: '●' },
  { id: 'QR Scanner', icon: '▣' },
  { id: 'Booths', icon: '◆' },
  { id: 'Map', icon: '▦' },
]

function App() {
  const store = usePassportStore()
  const isAdminRoute = window.location.pathname.replace(/\/$/, '') === '/admin'
  const [mode, setMode] = useState('attendee')
  const [authView, setAuthView] = useState('signup')
  const [activeTab, setActiveTab] = useState('Home')
  const [challengeView, setChallengeView] = useState('Active')
  const [focusedBoothId, setFocusedBoothId] = useState('')
  const [scannedBoothId, setScannedBoothId] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [celebrationKey, setCelebrationKey] = useState('')

  const playCelebration = (keyPrefix = 'manual') => {
    setCelebrationKey(`${keyPrefix}:${Date.now()}`)
    window.setTimeout(() => {
      setCelebrationKey('')
    }, 6200)
  }

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
  const activeMode = store.adminAuthenticated && mode === 'admin' ? 'admin' : 'attendee'

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

  useEffect(() => {
    if (
      store.session?.type === 'attendee' &&
      store.passportComplete &&
      store.currentAttendee &&
      !store.currentAttendeeEntry
    ) {
      store.submitEntry()
    }
  }, [
    store.session?.type,
    store.passportComplete,
    store.currentAttendee,
    store.currentAttendeeEntry,
    store,
  ])

  useEffect(() => {
    const entryId = store.currentAttendeeEntry?.id
    const attendeeId = store.currentAttendee?.id

    if (
      store.session?.type !== 'attendee' ||
      activeMode !== 'attendee' ||
      activeTab !== 'Home' ||
      !entryId ||
      !attendeeId
    ) {
      return undefined
    }

    const startTimer = window.setTimeout(() => {
      const storageKey = `raffleCelebrationCount:${attendeeId}:${entryId}`
      const currentCount = Number(window.localStorage.getItem(storageKey) || '0')

      if (currentCount >= 2) return

      window.localStorage.setItem(storageKey, String(currentCount + 1))
      playCelebration(`${storageKey}:${currentCount + 1}`)
    }, 0)

    return () => {
      window.clearTimeout(startTimer)
    }
  }, [
    activeMode,
    activeTab,
    store.session?.type,
    store.currentAttendee?.id,
    store.currentAttendeeEntry?.id,
  ])

  if (isAdminRoute) {
    return <AdminDashboard store={store} />
  }

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
        <ConfettiOverlay
          key={celebrationKey || 'celebration-idle'}
          active={Boolean(celebrationKey)}
        />
        <header className="app-bar">
          <button
            type="button"
            className={`icon-button ${
              activeMode === 'admin' || store.adminAuthenticated ? '' : 'is-hidden'
            }`}
            aria-label={
              activeMode === 'admin' ? 'Back to attendee app' : 'Open admin'
            }
            onClick={() => {
              if (activeMode === 'admin') {
                setMode('attendee')
                return
              }

              if (store.adminAuthenticated) {
                setMode('admin')
                return
              }

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
          {!store.session && activeMode !== 'admin' && (
            <AuthScreen
              key={authView}
              initialView={authView}
              onRegister={store.registerAttendee}
              onSignIn={store.signInAttendee}
              onAdminSignIn={async (credentials) => {
                const result = await store.signInAdmin(credentials)
                if (result.ok) setMode('admin')
                return result
              }}
            />
          )}

          {store.session && activeMode === 'attendee' && activeTab === 'Home' && (
            <>
              <PassportSummary
                attendeeName={store.currentAttendee?.name}
                completedIds={store.completedIds}
                requiredScanCount={store.requiredScanCount}
                onShowInstructions={() => setActiveTab('Instructions')}
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

              <RaffleEntryPanel
                disabled={!store.passportComplete}
                attendee={store.currentAttendee}
                hasEntered={Boolean(store.currentAttendeeEntry)}
                latestEntry={store.currentAttendeeEntry}
              />

              {store.currentAttendeeEntry && (
                <button
                  type="button"
                  className="celebration-replay-button"
                  onClick={() =>
                    playCelebration(
                      `manual:${store.currentAttendeeEntry?.id ?? 'entry'}`,
                    )
                  }
                  aria-label="Replay celebration"
                  title="Replay celebration"
                >
                  ↻
                </button>
              )}
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
              locationBoothId={store.currentLocationBoothId}
              onClearFocus={() => setFocusedBoothId('')}
              onScanBooth={(boothId) => {
                setFocusedBoothId(boothId)
                setActiveTab('QR Scanner')
              }}
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
            <ScannerPanel
              onScan={handleScan}
              onGoHome={() => setActiveTab('Home')}
            />
          )}

          {store.adminAuthenticated && activeMode === 'admin' && (
            <AdminPanel
              booths={store.booths}
              attendees={store.attendees}
              entries={store.entries}
              attendeeProgress={store.attendeeProgress}
              requiredScanCount={store.requiredScanCount}
              onSaveBooth={store.saveBooth}
              onDeleteBooth={store.deleteBooth}
              onPlaceBooth={store.placeBoothOnMap}
              onAddRaffleEntry={store.addRaffleEntry}
              onUpdateEntryChances={store.updateEntryChances}
              settings={store.settings}
              onSaveSettings={store.saveSettings}
              onExportCsv={store.exportEntriesCsv}
              onExportAttendeesCsv={store.exportAttendeesCsv}
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
