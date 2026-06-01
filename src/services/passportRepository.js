import { defaultBoothCategories, defaultBooths, defaultInstructions } from '../data/mockData'

const STORAGE_KEY = 'tradeshow-passport-raffle-v2'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_TABLE = 'passport_state'
const SHARED_ROW_ID = 'shared'
const EVENTS_ROW_ID = 'events'
const DEFAULT_EVENT_ID = 'landfx-passport-raffle'
const OFFLINE_QUEUE_KEY = 'tradeshow-passport-offline-queue-v1'
const DEFAULT_MAP_SRC = '/maps/asla_map.PNG'
const PLACEHOLDER_MAP_SRC = '/maps/placeholder_map.svg'
const DEFAULT_TERMS_TEXT =
  'By creating a passport, I agree to participate in this raffle and allow my submitted information to be used for raffle administration and event follow-up.'

const defaultEvent = {
  id: DEFAULT_EVENT_ID,
  name: 'ASLA Los Angeles 2026',
  status: 'active',
  createdAt: new Date().toISOString(),
}

function getInitialEventState() {
  return {
    booths: defaultBooths,
    completedIds: [],
    attendeeProgress: {},
    attendeeLocation: {},
    entries: [],
    winners: [],
    attendees: [],
    settings: {
      requiredScanCount: 4,
      instructions: defaultInstructions,
      mapSrc: DEFAULT_MAP_SRC,
      boothCategories: defaultBoothCategories,
      termsText: DEFAULT_TERMS_TEXT,
    },
  }
}

function getPlaceholderEventState() {
  return {
    ...getInitialEventState(),
    booths: [
      {
        id: 'test-booth',
        name: 'Test Expo Booth',
        category: 'Other',
        location: 'Booth 100',
        description: 'Placeholder booth for setting up a new passport raffle event.',
        websiteUrl: '',
        logoDataUrl: '',
        qrCode: 'TEST-BOOTH-100',
        color: '#6b7280',
        map: { x: 50, y: 50 },
      },
    ],
    completedIds: [],
    attendeeProgress: {},
    attendeeLocation: {},
    entries: [],
    winners: [],
    attendees: [],
    settings: {
      requiredScanCount: 1,
      instructions: defaultInstructions,
      mapSrc: PLACEHOLDER_MAP_SRC,
      boothCategories: [],
      termsText: DEFAULT_TERMS_TEXT,
    },
  }
}

function getEventBaseState(eventId = DEFAULT_EVENT_ID) {
  return eventId === DEFAULT_EVENT_ID ? getInitialEventState() : getPlaceholderEventState()
}

const initialState = {
  ...getInitialEventState(),
  events: [defaultEvent],
  activeEventId: DEFAULT_EVENT_ID,
  session: null,
  adminAuthenticated: false,
  adminSession: null,
  adminUsers: [],
}

function normalizeEvents(events) {
  if (!Array.isArray(events) || !events.length) return [defaultEvent]

  const allowedStatuses = new Set(['active', 'hidden', 'archived'])

  return events.map((event) => ({
    ...event,
    id: event.id || crypto.randomUUID(),
    name: event.name || 'Untitled Event',
    status: allowedStatuses.has(event.status) ? event.status : 'active',
    createdAt: event.createdAt || new Date().toISOString(),
  }))
}

function getActiveEventId(state) {
  const events = normalizeEvents(state.events)
  const matchingEvent = events.find((event) => event.id === state.activeEventId)
  if (matchingEvent) return matchingEvent.id

  return events.find((event) => event.status === 'active')?.id ?? events[0].id
}

function readState() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return initialState

    const parsed = JSON.parse(stored)
    const events = normalizeEvents(parsed.events)
    return {
      ...initialState,
      ...parsed,
      events,
      activeEventId: parsed.activeEventId || getActiveEventId({ ...parsed, events }),
      settings: {
        ...initialState.settings,
        ...parsed.settings,
        instructions: parsed.settings?.instructions?.length
          ? parsed.settings.instructions
          : initialState.settings.instructions,
      },
    }
  } catch {
    return initialState
  }
}

function writeState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function readOfflineQueue() {
  try {
    const stored = window.localStorage.getItem(OFFLINE_QUEUE_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeOfflineQueue(queue) {
  window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
}

function getOnlineStatus() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

function getOfflineQueueStatus() {
  return {
    online: getOnlineStatus(),
    pendingCount: readOfflineQueue().length,
  }
}

function queueSharedPatch(patch, eventId) {
  const queue = readOfflineQueue()
  const queuedPatch = {
    id: crypto.randomUUID(),
    eventId,
    patch,
    queuedAt: new Date().toISOString(),
  }

  writeOfflineQueue([...queue, queuedPatch])
  return queuedPatch
}

function shouldQueueSupabaseError(error) {
  if (!getOnlineStatus()) return true
  if (!error?.status) return true
  return error.status >= 500
}

function hasLiveEventData(eventData) {
  return Boolean(
    eventData?.entries?.length ||
      eventData?.attendees?.length ||
      eventData?.winners?.length ||
      Object.keys(eventData?.attendeeProgress ?? {}).length,
  )
}

function looksLikeDefaultEventClone(eventData) {
  const defaultBoothIds = new Set(defaultBooths.map((booth) => booth.id))
  const boothIds = eventData?.booths?.map((booth) => booth.id) ?? []
  const defaultMatches = boothIds.filter((id) => defaultBoothIds.has(id))

  return defaultMatches.length >= Math.min(3, defaultBooths.length)
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

function getSharedState(state) {
  return {
    booths: state.booths,
    entries: state.entries,
    winners: state.winners,
    attendees: state.attendees,
    attendeeProgress: state.attendeeProgress,
    attendeeLocation: state.attendeeLocation,
    settings: state.settings,
  }
}

function getSharedRowId(eventId = DEFAULT_EVENT_ID) {
  return `event:${eventId}`
}

function pickSyncedAssetUrl(sharedValue, localValue) {
  if (typeof sharedValue === 'string' && sharedValue.startsWith('data:')) {
    return sharedValue
  }

  if (typeof localValue === 'string' && localValue.startsWith('data:')) {
    return localValue
  }

  return sharedValue ?? localValue
}

function mergeSharedState(state, sharedState, options = {}) {
  if (!sharedState) return state
  const preserveLocalSections = options.preserveLocalSections ?? {}
  const baseSettings = getEventBaseState(options.eventId ?? state.activeEventId).settings
  const attendeeProgress = {
    ...state.attendeeProgress,
    ...sharedState.attendeeProgress,
  }
  const attendeeLocation = {
    ...state.attendeeLocation,
    ...sharedState.attendeeLocation,
  }
  const completedIds =
    state.session?.type === 'attendee' && attendeeProgress[state.session.attendeeId]
      ? attendeeProgress[state.session.attendeeId]
      : state.completedIds

  return {
    ...state,
    completedIds,
    booths: preserveLocalSections.booths
      ? state.booths
      : sharedState.booths?.length
        ? sharedState.booths
        : state.booths,
    entries: Array.isArray(sharedState.entries) ? sharedState.entries : state.entries,
    winners: Array.isArray(sharedState.winners) ? sharedState.winners : state.winners,
    attendees: Array.isArray(sharedState.attendees)
      ? sharedState.attendees
      : state.attendees,
    attendeeProgress,
    attendeeLocation,
    settings: preserveLocalSections.settings
      ? state.settings
      : {
          ...state.settings,
          ...sharedState.settings,
          instructions: sharedState.settings?.instructions?.length
            ? sharedState.settings.instructions
            : state.settings.instructions,
          mapSrc:
            pickSyncedAssetUrl(
              sharedState.settings?.mapSrc,
              state.settings?.mapSrc,
            ) || baseSettings.mapSrc,
          homeImageSrc: pickSyncedAssetUrl(
            sharedState.settings?.homeImageSrc,
            state.settings?.homeImageSrc,
          ),
          raffleCompleteImageSrc: pickSyncedAssetUrl(
            sharedState.settings?.raffleCompleteImageSrc,
            state.settings?.raffleCompleteImageSrc,
          ),
          boothCategories: Array.isArray(sharedState.settings?.boothCategories)
            ? sharedState.settings.boothCategories
            : baseSettings.boothCategories,
          termsText:
            sharedState.settings?.termsText ||
            state.settings?.termsText ||
            baseSettings.termsText ||
            DEFAULT_TERMS_TEXT,
        },
  }
}

function mergeUniqueByIdentity(currentItems = [], nextItems = []) {
  const itemsByKey = new Map()

  currentItems.forEach((item) => {
    itemsByKey.set(item.attendeeId || item.email || item.id, item)
  })
  nextItems.forEach((item) => {
    itemsByKey.set(item.attendeeId || item.email || item.id, item)
  })

  return [...itemsByKey.values()]
}

function mergeSharedPatch(sharedState, patch) {
  const currentSharedState = sharedState ?? {
    ...getInitialEventState(),
    booths: [],
    entries: [],
    winners: [],
    attendees: [],
    attendeeProgress: {},
    attendeeLocation: {},
    settings: initialState.settings,
  }

  return {
    ...currentSharedState,
    ...patch,
    attendees: patch.attendees
      ? mergeUniqueByIdentity(currentSharedState.attendees, patch.attendees)
      : currentSharedState.attendees,
    entries: patch.entries
      ? patch.entriesReplace
        ? patch.entries
        : mergeUniqueByIdentity(currentSharedState.entries, patch.entries)
      : currentSharedState.entries,
    winners: patch.winners
      ? patch.winnersReplace
        ? patch.winners
        : mergeUniqueByIdentity(currentSharedState.winners, patch.winners)
      : currentSharedState.winners,
    attendeeProgress: patch.attendeeProgress
      ? {
          ...currentSharedState.attendeeProgress,
          ...patch.attendeeProgress,
        }
      : currentSharedState.attendeeProgress,
    attendeeLocation: patch.attendeeLocation
      ? {
          ...currentSharedState.attendeeLocation,
          ...patch.attendeeLocation,
        }
      : currentSharedState.attendeeLocation,
    settings: patch.settings
      ? { ...currentSharedState.settings, ...patch.settings }
      : currentSharedState.settings,
  }
}

async function requestSupabase(path, options = {}) {
  if (!isSupabaseConfigured()) return null

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const detail = await response.text()
    const error = new Error(`Supabase request failed: ${response.status} ${detail}`)
    error.status = response.status
    throw error
  }

  if (response.status === 204) return null
  return response.json()
}

async function loadRemoteShared(eventId = DEFAULT_EVENT_ID) {
  const rows = await requestSupabase(
    `${SUPABASE_TABLE}?id=eq.${getSharedRowId(eventId)}&select=data&limit=1`,
  )
  const eventData = rows?.[0]?.data ?? null

  if (eventId === DEFAULT_EVENT_ID) {
    const legacyRows = await requestSupabase(
      `${SUPABASE_TABLE}?id=eq.${SHARED_ROW_ID}&select=data&limit=1`,
    )
    const legacyData = legacyRows?.[0]?.data ?? null
    const eventHasLiveData = hasLiveEventData(eventData)
    const legacyHasLiveData = hasLiveEventData(legacyData)

    if (!eventHasLiveData && legacyHasLiveData) return legacyData
    if (eventData) return eventData
    return legacyData
  }

  if (eventData && !hasLiveEventData(eventData) && looksLikeDefaultEventClone(eventData)) {
    return getPlaceholderEventState()
  }

  if (eventData) return eventData
  return null
}

export const passportRepository = {
  defaultEvent,
  load() {
    return readState()
  },
  save(state) {
    writeState(state)
  },
  mergeShared(state, sharedState, options) {
    return mergeSharedState(state, sharedState, options)
  },
  getInitialEventState,
  getPlaceholderEventState,
  getEventBaseState,
  getActiveEventId,
  async loadEventIndex() {
    try {
      const rows = await requestSupabase(
        `${SUPABASE_TABLE}?id=eq.${EVENTS_ROW_ID}&select=data&limit=1`,
      )
      return normalizeEvents(rows?.[0]?.data?.events)
    } catch (error) {
      console.warn(error)
      return null
    }
  },
  async saveEventIndex(events) {
    try {
      await requestSupabase(`${SUPABASE_TABLE}?on_conflict=id`, {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          id: EVENTS_ROW_ID,
          data: { events: normalizeEvents(events) },
          updated_at: new Date().toISOString(),
        }),
      })
    } catch (error) {
      console.warn(error)
    }
  },
  async loadShared(eventId = DEFAULT_EVENT_ID) {
    try {
      return loadRemoteShared(eventId)
    } catch (error) {
      console.warn(error)
      return null
    }
  },
  async saveShared(state) {
    try {
      await requestSupabase(`${SUPABASE_TABLE}?on_conflict=id`, {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          id: getSharedRowId(state.activeEventId),
          data: getSharedState(state),
          updated_at: new Date().toISOString(),
        }),
      })
    } catch (error) {
      console.warn(error)
    }
  },
  async saveSharedPatch(patch, eventId = DEFAULT_EVENT_ID) {
    try {
      const sharedState = await loadRemoteShared(eventId)
      const nextSharedState = mergeSharedPatch(sharedState, patch)

      await requestSupabase(`${SUPABASE_TABLE}?on_conflict=id`, {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          id: getSharedRowId(eventId),
          data: nextSharedState,
          updated_at: new Date().toISOString(),
        }),
      })
      return { ok: true, queued: false }
    } catch (error) {
      console.warn(error)
      if (shouldQueueSupabaseError(error)) {
        queueSharedPatch(patch, eventId)
        return { ok: false, queued: true }
      }
      return { ok: false, queued: false }
    }
  },
  getOfflineQueueStatus,
  async flushOfflineQueue() {
    const queue = readOfflineQueue()
    if (!queue.length) return getOfflineQueueStatus()
    if (!isSupabaseConfigured() || !getOnlineStatus()) return getOfflineQueueStatus()

    const remaining = []

    for (const queuedPatch of queue) {
      try {
        const sharedState = await loadRemoteShared(queuedPatch.eventId)
        const nextSharedState = mergeSharedPatch(sharedState, queuedPatch.patch)

        await requestSupabase(`${SUPABASE_TABLE}?on_conflict=id`, {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify({
            id: getSharedRowId(queuedPatch.eventId),
            data: nextSharedState,
            updated_at: new Date().toISOString(),
          }),
        })
      } catch (error) {
        console.warn(error)
        if (shouldQueueSupabaseError(error)) {
          remaining.push(queuedPatch)
        }
      }
    }

    writeOfflineQueue(remaining)
    return getOfflineQueueStatus()
  },
  isRemoteEnabled() {
    return isSupabaseConfigured()
  },
  reset() {
    writeState(initialState)
    return initialState
  },
}
