import { Capacitor } from '@capacitor/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import './glass-theme.css'
import './passport-background.css'
import { defaultInstructions } from './data/mockData'
import { useAppDeepLinks } from './hooks/useAppDeepLinks'
import { isAdminPath } from './services/adminDeepLink'
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
import { NavIcon } from './components/NavIcon'

const NAV_ICON_SIZE = 18
const isNative = Capacitor.isNativePlatform()

const attendeeTabs = [
  { id: 'Home', label: 'Home', icon: 'home' },
  { id: 'Instructions', label: 'Info', icon: 'instructions' },
  { id: 'QR Scanner', label: 'Scan', icon: 'scanner' },
  { id: 'Booths', label: 'Booths', icon: 'booths' },
  { id: 'Map', label: 'Map', icon: 'map' },
]

const leftNavTabs = attendeeTabs.slice(0, 2)
const scannerNavTab = attendeeTabs[2]
const rightNavTabs = attendeeTabs.slice(3)

function App() {
  const store = usePassportStore()
  const [adminRouteActive, setAdminRouteActive] = useState(() =>
    isAdminPath(window.location.pathname),
  )
  const isAdminRoute =
    adminRouteActive || (!isNative && isAdminPath(window.location.pathname))
  const openAdminRoute = useCallback(() => {
    setAdminRouteActive(true)
  }, [])

  useAppDeepLinks({ onAdminRoute: openAdminRoute })
  const [mode, setMode] = useState('attendee')
  const [authView, setAuthView] = useState('signup')
  const [activeTab, setActiveTab] = useState('Home')
  const [challengeView, setChallengeView] = useState('Active')
  const [selectedMapBoothId, setSelectedMapBoothId] = useState('')
  const [mapFocusBoothId, setMapFocusBoothId] = useState('')
  const [mapFocusKey, setMapFocusKey] = useState(0)
  const [consumedMapFocusKey, setConsumedMapFocusKey] = useState(0)
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
  const boothCategoryOptions = useMemo(() => {
    const categorySet = new Set([
      ...(store.settings?.boothCategories ?? []),
      ...store.booths.map((booth) => booth.category).filter(Boolean),
    ])

    return ['All', ...categorySet]
  }, [store.booths, store.settings?.boothCategories])

  const selectedCategory = boothCategoryOptions.includes(category) ? category : 'All'

  const filteredBooths = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return store.booths.filter((booth) => {
      const matchesCategory =
        selectedCategory === 'All' || booth.category === selectedCategory
      const matchesQuery =
        !normalizedQuery ||
        [booth.name, booth.location, booth.description, booth.category]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)

      return matchesCategory && matchesQuery
    })
  }, [query, selectedCategory, store.booths])

  const completedBooths = filteredBooths.filter((booth) =>
    store.completedIds.includes(booth.id),
  )
  const activeBooths = filteredBooths.filter(
    (booth) => !store.completedIds.includes(booth.id),
  )
  const visibleBooths =
    challengeView === 'Completed' ? completedBooths : activeBooths
  const activeMode = store.adminAuthenticated && mode === 'admin' ? 'admin' : 'attendee'
  const pendingSyncCount = store.syncStatus?.pendingCount ?? 0
  const isOffline = store.syncStatus?.online === false
  const isBackgroundLoading = store.isBootstrapping
  const canShowSyncStatus = Boolean(store.session || store.adminAuthenticated)
  const isSyncingOnline =
    canShowSyncStatus && !isOffline && (pendingSyncCount > 0 || isBackgroundLoading)
  const offlineSyncMessage = canShowSyncStatus && isOffline
    ? pendingSyncCount
      ? `${pendingSyncCount} saved update${pendingSyncCount === 1 ? '' : 's'} will sync when online`
      : 'Offline mode'
    : ''
  const attendeeActiveEvent =
    store.activeEvents.find((event) => event.id === store.activeEventId) ??
    store.activeEvents[0] ??
    null
  const hasValidAttendeeSession = Boolean(
    store.session?.type === 'attendee' &&
      (store.attendees.some((attendee) => attendee.id === store.session.attendeeId) ||
        store.isBootstrapping),
  )
  const shouldShowAuth =
    activeMode !== 'admin' && !hasValidAttendeeSession
  const showTopBar = activeMode === 'admin' || !hasValidAttendeeSession

  const handleAdminToggle = () => {
    if (activeMode === 'admin') {
      setMode('attendee')
      return
    }

    if (store.adminAuthenticated) {
      setMode('admin')
      return
    }

    setAuthView('admin')
  }

  const handleSignOut = () => {
    store.signOut()
    setAuthView('signin')
  }

  const handleScan = (code) => {
    const result = store.checkInByCode(code)
    if (result.id) {
      setScannedBoothId(result.id)
      setSelectedMapBoothId(result.id)
      setMapFocusBoothId(result.id)
      setMapFocusKey((current) => current + 1)
    }
    return result
  }

  useEffect(() => {
    if (
      !isAdminRoute &&
      activeMode === 'attendee' &&
      !store.session &&
      store.activeEvents.length > 0 &&
      !store.activeEvents.some((event) => event.id === store.activeEventId)
    ) {
      store.selectEvent(store.activeEvents[0].id)
    }
  }, [
    isAdminRoute,
    activeMode,
    store.session,
    store.activeEventId,
    store.activeEvents,
    store,
  ])

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

  useEffect(() => {
    if (activeTab !== 'Map') return undefined
    store.refreshFromRemote?.()
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refresh when opening Map
  }, [activeTab])

  if (isAdminRoute) {
    return <AdminDashboard store={store} />
  }

  return (
    <main className={`app-stage${isNative ? ' is-native' : ''}`}>
      <section
        className={`phone-shell ${
          hasValidAttendeeSession && activeMode === 'attendee'
            ? 'has-vision-nav'
            : 'no-bottom-nav'
        }${showTopBar ? '' : ' phone-shell--no-top-bar'}`}
        aria-label="Trade show passport app"
      >
        <ConfettiOverlay
          key={celebrationKey || 'celebration-idle'}
          active={Boolean(celebrationKey)}
          raffleCompleteImageSrc={store.settings?.raffleCompleteImageSrc}
        />
        {showTopBar && (
          <header className="app-bar">
            <button
              type="button"
              className={`icon-button ${
                activeMode === 'admin' || store.adminAuthenticated ? '' : 'is-hidden'
              }`}
              aria-label={
                activeMode === 'admin' ? 'Back to attendee app' : 'Open admin'
              }
              onClick={handleAdminToggle}
            >
              {activeMode === 'admin' ? '‹' : '⚙'}
            </button>
            <div className="app-bar-title">
              <strong>Land F/X Passport Raffle</strong>
              {isSyncingOnline && (
                <span
                  className="sync-status-dot"
                  role="status"
                  aria-label={
                    isBackgroundLoading
                      ? 'Loading latest event data'
                      : `Syncing ${pendingSyncCount} saved update${pendingSyncCount === 1 ? '' : 's'}`
                  }
                  title={
                    isBackgroundLoading
                      ? 'Loading latest event data'
                      : 'Saved scans are syncing in the background'
                  }
                />
              )}
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Sign out"
              onClick={handleSignOut}
            >
              ⎋
            </button>
          </header>
        )}

        {!showTopBar && (
          <div className="app-float-actions">
            {store.adminAuthenticated && (
              <button
                type="button"
                className="icon-button app-float-button"
                aria-label="Open admin"
                onClick={handleAdminToggle}
              >
                ⚙
              </button>
            )}
            {isSyncingOnline && (
              <span
                className="sync-status-dot sync-status-dot--float"
                role="status"
                aria-label={
                  isBackgroundLoading
                    ? 'Loading latest event data'
                    : `Syncing ${pendingSyncCount} saved update${pendingSyncCount === 1 ? '' : 's'}`
                }
                title={
                  isBackgroundLoading
                    ? 'Loading latest event data'
                    : 'Saved scans are syncing in the background'
                }
              />
            )}
            <button
              type="button"
              className="icon-button app-float-button"
              aria-label="Sign out"
              onClick={handleSignOut}
            >
              ⎋
            </button>
          </div>
        )}
        {offlineSyncMessage && (
          <div className="sync-status-badge is-offline" role="status">
            {offlineSyncMessage}
          </div>
        )}

        <div className={`app-content${activeTab === 'Map' ? ' is-map-view' : ''}`}>
          {shouldShowAuth && (
            <AuthScreen
              activeEvent={attendeeActiveEvent}
              activeEvents={store.activeEvents}
              key={authView}
              initialView={authView}
              onRegister={store.registerAttendee}
              onSignIn={store.signInAttendee}
              onSelectEvent={store.selectEvent}
              termsText={store.settings?.termsText}
              onAdminSignIn={async (credentials) => {
                const result = await store.signInAdmin(credentials)
                if (result.ok) setMode('admin')
                return result
              }}
            />
          )}

          {hasValidAttendeeSession && activeMode === 'attendee' && activeTab === 'Home' && (
            <>
              <PassportSummary
                attendeeName={store.currentAttendee?.name}
                completedIds={store.completedIds}
                requiredScanCount={store.requiredScanCount}
                homeImageSrc={store.settings?.homeImageSrc}
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

          {hasValidAttendeeSession && activeMode === 'attendee' && activeTab === 'Booths' && (
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
                    placeholder="Expo booth or booth number"
                  />
                </label>
                <label className="select-field">
                  <span>Filter</span>
                  <select
                    value={selectedCategory}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    {boothCategoryOptions.map((item) => (
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
                      setSelectedMapBoothId('')
                      setMapFocusBoothId(boothId)
                      setMapFocusKey((current) => current + 1)
                      setActiveTab('Map')
                    }}
                  />
                ))}
                {!visibleBooths.length && (
                  <p className="empty-state">No expo booths match this view.</p>
                )}
              </div>
            </section>
          )}

          {hasValidAttendeeSession && activeMode === 'attendee' && activeTab === 'Map' && (
            <MapView
              booths={store.booths}
              completedIds={store.completedIds}
              selectedBoothId={selectedMapBoothId}
              focusBoothId={
                mapFocusKey !== consumedMapFocusKey ? mapFocusBoothId : ''
              }
              focusKey={mapFocusKey}
              locationBoothId={store.currentLocationBoothId}
              mapSrc={store.settings?.mapSrc}
              mapVersion={store.settings?.remoteUpdatedAt}
              onFocusHandled={() => setConsumedMapFocusKey(mapFocusKey)}
              onBoothSelect={setSelectedMapBoothId}
              onClearFocus={() => {
                setSelectedMapBoothId('')
                setMapFocusBoothId('')
                setConsumedMapFocusKey(mapFocusKey)
              }}
              onScanBooth={(boothId) => {
                setSelectedMapBoothId(boothId)
                setActiveTab('QR Scanner')
              }}
            />
          )}

          {hasValidAttendeeSession &&
            activeMode === 'attendee' &&
            activeTab === 'Instructions' && (
            <section className="instructions-screen">
              <h2>How to play</h2>
              {instructions.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </section>
          )}

          {hasValidAttendeeSession &&
            activeMode === 'attendee' &&
            activeTab === 'QR Scanner' && (
            <ScannerPanel
              onScan={handleScan}
              onGoHome={() => setActiveTab('Home')}
              onGoMap={() => setActiveTab('Map')}
            />
          )}

          {store.adminAuthenticated && activeMode === 'admin' && (
            <AdminPanel
              booths={store.booths}
              attendees={store.attendees}
              entries={store.entries}
              winners={store.winners}
              attendeeProgress={store.attendeeProgress}
              requiredScanCount={store.requiredScanCount}
              events={store.events}
              activeEvent={store.activeEvent}
              activeEventId={store.activeEventId}
              adminAccessToken={store.adminSession?.accessToken}
              onSelectEvent={store.selectEvent}
              onSaveEvent={store.saveEvent}
              onDuplicateEvent={store.duplicateEvent}
              onArchiveEvent={store.archiveEvent}
              onUnarchiveEvent={store.unarchiveEvent}
              onSaveBooth={store.saveBooth}
              onDeleteBooth={store.deleteBooth}
              onPlaceBooth={store.placeBoothOnMap}
              onAddRaffleEntry={store.addRaffleEntry}
              onUpdateEntryChances={store.updateEntryChances}
              onDeleteRaffleEntry={store.deleteRaffleEntry}
              onWinnerSelected={store.recordWinner}
              onResetWinners={store.resetWinners}
              settings={store.settings}
              onSaveSettings={store.saveSettings}
              onExportCsv={store.exportEntriesCsv}
              onExportAttendeesCsv={store.exportAttendeesCsv}
            />
          )}
        </div>

        {hasValidAttendeeSession && activeMode === 'attendee' && (
          <nav className="bottom-nav bottom-nav--vision" aria-label="Attendee views">
            {leftNavTabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={`bottom-nav-item${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="bottom-nav-icon-slot">
                  <NavIcon name={tab.icon} size={NAV_ICON_SIZE} />
                </span>
                <span>{tab.label}</span>
              </button>
            ))}

            <button
              type="button"
              className={`bottom-nav-scanner${activeTab === scannerNavTab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(scannerNavTab.id)}
              aria-label={scannerNavTab.id}
            >
              <span className="bottom-nav-icon-slot bottom-nav-scanner-ring">
                <NavIcon name={scannerNavTab.icon} size={NAV_ICON_SIZE} />
              </span>
              <span>{scannerNavTab.label}</span>
            </button>

            {rightNavTabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={`bottom-nav-item${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="bottom-nav-icon-slot">
                  <NavIcon name={tab.icon} size={NAV_ICON_SIZE} />
                </span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        )}
      </section>
    </main>
  )
}

export default App
