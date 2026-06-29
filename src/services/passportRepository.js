import { defaultBoothCategories, defaultBooths, defaultInstructions } from '../data/mockData'
import { resolveApiUrl } from './apiBaseUrl'
import { readAttendeeAuthSession } from './attendeeAuth'
import { getUploadedAssetTimestamp } from '../utils/mapSrc'

const STORAGE_KEY = 'tradeshow-passport-raffle-v2'
const SESSION_STORAGE_KEY = 'tradeshow-passport-session-v1'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_TABLE = 'passport_state'
const SHARED_ROW_ID = 'shared'
const EVENTS_ROW_ID = 'events'
const DEFAULT_EVENT_ID = 'landfx-passport-raffle'
const OFFLINE_QUEUE_KEY = 'tradeshow-passport-offline-queue-v1'
const SUPABASE_REQUEST_TIMEOUT_MS = 10000
const DEFAULT_MAP_SRC = '/maps/asla_map.PNG'
const PLACEHOLDER_MAP_SRC = '/maps/placeholder_map.svg'
const DEFAULT_TERMS_TEXT =
  'By creating a passport, I agree to participate in this raffle and allow my submitted information to be used for raffle administration and event follow-up.'

const defaultEvent = {
  id: DEFAULT_EVENT_ID,
  name: 'ASLA Los Angeles 2026',
  status: 'active',
  createdAt: new Date().toISOString(),
  signupCode: 'lfxrocks',
  experientActCode: '0000000000000000',
  experientBadgeId: '0',
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
    signupCode: String(event.signupCode ?? '').trim(),
    experientActCode: String(event.experientActCode ?? '0000000000000000').trim(),
    experientBadgeId: String(event.experientBadgeId ?? '0').trim() || '0',
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
  if (isCloudFirstEnabled()) {
    writeSessionSlice(state)
    return
  }

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

function queueSharedPatch(patch, eventId, meta = {}) {
  const queue = readOfflineQueue()
  const queuedPatch = {
    id: crypto.randomUUID(),
    eventId,
    patch,
    recordScan: Boolean(meta.recordScan),
    attendeeId: meta.attendeeId ?? null,
    boothId: meta.boothId ?? null,
    scanToken: meta.scanToken ?? null,
    idempotencyKey: meta.idempotencyKey ?? crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  }

  writeOfflineQueue([...queue, queuedPatch])
  return queuedPatch
}

function isSignedScanEnabled() {
  return import.meta.env.VITE_SIGNED_QR_CODES === 'true'
}

async function requestRecordScan(body, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (options.adminAccessToken) {
    headers.Authorization = `Bearer ${options.adminAccessToken}`
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(resolveApiUrl('/api/record-scan'), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const result = await response.json().catch(() => ({
      ok: false,
      message: 'Record scan returned an invalid response.',
    }))

    if (!response.ok || !result.ok) {
      const error = new Error(result.message || `Record scan failed: ${response.status}`)
      error.status = response.status
      error.duplicate = result.duplicate
      throw error
    }

    return result
  } finally {
    window.clearTimeout(timeout)
  }
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

function isCloudFirstEnabled() {
  return isSupabaseConfigured() && import.meta.env.VITE_CLOUD_FIRST !== 'false'
}

function isWriteProxyEnabled() {
  return isCloudFirstEnabled() && import.meta.env.VITE_DIRECT_SUPABASE_WRITES !== 'true'
}

function isNormalizedReadsEnabled() {
  return isCloudFirstEnabled() && import.meta.env.VITE_NORMALIZED_READS === 'true'
}

let adminAccessTokenGetter = () => null

export function setAdminAccessTokenGetter(getter) {
  adminAccessTokenGetter = typeof getter === 'function' ? getter : () => null
}

async function getReadContext(overrides = {}) {
  const adminAccessToken =
    overrides.adminAccessToken ?? (await adminAccessTokenGetter()) ?? null
  const attendeeAccessToken =
    overrides.attendeeAccessToken ?? readAttendeeAuthSession()?.accessToken ?? null

  return { adminAccessToken, attendeeAccessToken }
}

async function requestWriteProxy(body, options = {}) {
  const adminAccessToken = options.adminAccessToken ?? (await adminAccessTokenGetter())
  const headers = {
    'Content-Type': 'application/json',
  }

  if (adminAccessToken) {
    headers.Authorization = `Bearer ${adminAccessToken}`
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(resolveApiUrl('/api/passport-write'), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const result = await response.json().catch(() => ({
      ok: false,
      message: 'Write proxy returned an invalid response.',
    }))

    if (!response.ok || !result.ok) {
      const error = new Error(result.message || `Write proxy failed: ${response.status}`)
      error.status = response.status
      throw error
    }

    return result
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Write proxy request timed out.')
      timeoutError.status = 408
      throw timeoutError
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function readSessionSlice() {
  try {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!stored) return null

    const parsed = JSON.parse(stored)
    return {
      session: parsed.session ?? null,
      activeEventId: parsed.activeEventId || DEFAULT_EVENT_ID,
      adminAuthenticated: Boolean(parsed.adminAuthenticated),
      adminSession: parsed.adminSession ?? null,
    }
  } catch {
    return null
  }
}

function writeSessionSlice(state) {
  const adminSession = state.adminSession
    ? {
        accessToken: state.adminSession.accessToken,
        refreshToken: state.adminSession.refreshToken ?? '',
        expiresAt: state.adminSession.expiresAt,
      }
    : null

  window.localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      session: state.session,
      activeEventId: state.activeEventId,
      adminAuthenticated: state.adminAuthenticated,
      adminSession,
    }),
  )
}

function sanitizeAppState(state) {
  if (
    state.session?.type === 'attendee' &&
    !state.attendees.some((attendee) => attendee.id === state.session.attendeeId)
  ) {
    if (isCloudFirstEnabled()) {
      // Attendee roster hydrates from Supabase immediately after startup.
      return state
    }

    return {
      ...state,
      session: null,
      completedIds: [],
    }
  }

  return state
}

function loadLocalShell() {
  if (!isCloudFirstEnabled()) return sanitizeAppState(readState())

  const sessionSlice = readSessionSlice()
  const activeEventId = sessionSlice?.activeEventId ?? DEFAULT_EVENT_ID

  return sanitizeAppState({
    ...initialState,
    ...getEventBaseState(activeEventId),
    activeEventId,
    session: sessionSlice?.session ?? null,
    adminAuthenticated: sessionSlice?.adminAuthenticated ?? false,
    adminSession: sessionSlice?.adminSession ?? null,
  })
}

async function loadRemoteEventIndex() {
  try {
    if (isNormalizedReadsEnabled()) {
      const rows = await requestSupabase(
        'events?select=id,name,status,created_at&order=created_at.asc',
      )
      if (rows?.length) {
        return normalizeEvents(
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            status: row.status,
            createdAt: row.created_at,
          })),
        )
      }
    }

    const rows = await requestSupabase(
      `${SUPABASE_TABLE}?id=eq.${EVENTS_ROW_ID}&select=data&limit=1`,
    )
    return normalizeEvents(rows?.[0]?.data?.events)
  } catch (error) {
    console.warn(error)
    return null
  }
}

async function bootstrapFromRemote(activeEventId = DEFAULT_EVENT_ID) {
  const sessionSlice = readSessionSlice()
  const preferredEventId = sessionSlice?.activeEventId ?? activeEventId

  const [eventsResult, initialSharedState] = await Promise.all([
    loadRemoteEventIndex(),
    loadRemoteShared(preferredEventId),
  ])

  const events = normalizeEvents(eventsResult ?? [defaultEvent])
  const resolvedEventId =
    events.find((event) => event.id === preferredEventId)?.id ??
    events.find((event) => event.status === 'active')?.id ??
    events[0]?.id ??
    DEFAULT_EVENT_ID

  const sharedState =
    resolvedEventId === preferredEventId
      ? initialSharedState
      : await loadRemoteShared(resolvedEventId)

  const baseState = {
    ...initialState,
    ...getEventBaseState(resolvedEventId),
    events,
    activeEventId: resolvedEventId,
    session: sessionSlice?.session ?? null,
    adminAuthenticated: sessionSlice?.adminAuthenticated ?? false,
    adminSession: sessionSlice?.adminSession ?? null,
  }

  if (!sharedState) return sanitizeAppState(baseState)

  return sanitizeAppState(
    mergeSharedState(baseState, sharedState, { eventId: resolvedEventId }),
  )
}

function isRemoteAssetRef(value) {
  return (
    typeof value === 'string' &&
    (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://'))
  )
}

function pickSyncedAssetUrl(sharedValue, localValue) {
  if (sharedValue) return sharedValue
  return localValue
}

function pickAssetSetting(eventValue, legacyValue, eventUpdatedAt, legacyUpdatedAt) {
  if (!eventValue && !legacyValue) return undefined
  if (!legacyValue) return eventValue
  if (!eventValue) return legacyValue
  if (isRemoteAssetRef(eventValue) && isRemoteAssetRef(legacyValue)) {
    const eventAssetTs = getUploadedAssetTimestamp(eventValue)
    const legacyAssetTs = getUploadedAssetTimestamp(legacyValue)
    if (eventAssetTs && legacyAssetTs && eventAssetTs !== legacyAssetTs) {
      return eventAssetTs >= legacyAssetTs ? eventValue : legacyValue
    }
  }
  if (isRemoteAssetRef(eventValue) && !isRemoteAssetRef(legacyValue)) return eventValue
  if (isRemoteAssetRef(legacyValue) && !isRemoteAssetRef(eventValue)) return legacyValue
  if (eventUpdatedAt && legacyUpdatedAt) {
    return new Date(eventUpdatedAt) >= new Date(legacyUpdatedAt)
      ? eventValue
      : legacyValue
  }
  return eventValue
}

function getAssetSettingUpdatedAt(
  value,
  eventValue,
  legacyValue,
  eventUpdatedAt,
  legacyUpdatedAt,
) {
  if (!value) return legacyUpdatedAt || eventUpdatedAt
  if (value === eventValue) return eventUpdatedAt || legacyUpdatedAt
  if (value === legacyValue) return legacyUpdatedAt || eventUpdatedAt
  return legacyUpdatedAt || eventUpdatedAt
}

function buildMergedSettings(
  eventSettings = {},
  legacySettings = {},
  eventUpdatedAt,
  legacyUpdatedAt,
) {
  return {
    ...legacySettings,
    ...eventSettings,
    mapSrc: pickAssetSetting(
      eventSettings.mapSrc,
      legacySettings.mapSrc,
      eventUpdatedAt,
      legacyUpdatedAt,
    ),
    homeImageSrc: pickAssetSetting(
      eventSettings.homeImageSrc,
      legacySettings.homeImageSrc,
      eventUpdatedAt,
      legacyUpdatedAt,
    ),
    raffleCompleteImageSrc: pickAssetSetting(
      eventSettings.raffleCompleteImageSrc,
      legacySettings.raffleCompleteImageSrc,
      eventUpdatedAt,
      legacyUpdatedAt,
    ),
  }
}

function attachRemoteMeta(data, updatedAt) {
  if (!data) return null

  return {
    ...data,
    settings: {
      ...data.settings,
      remoteUpdatedAt: updatedAt,
    },
  }
}

function mergeDefaultEventShared(eventData, eventUpdatedAt, legacyData, legacyUpdatedAt) {
  if (!eventData && !legacyData) return null
  if (!legacyData) return attachRemoteMeta(eventData, eventUpdatedAt)
  if (!eventData) return attachRemoteMeta(legacyData, legacyUpdatedAt)

  const eventHasLive = hasLiveEventData(eventData)
  const useLegacyLiveData = !eventHasLive && hasLiveEventData(legacyData)
  const mergedSettings = buildMergedSettings(
    eventData.settings,
    legacyData.settings,
    eventUpdatedAt,
    legacyUpdatedAt,
  )
  const merged = {
    booths: eventData.booths?.length ? eventData.booths : legacyData.booths ?? [],
    settings: mergedSettings,
    entries: useLegacyLiveData ? legacyData.entries ?? [] : eventData.entries ?? [],
    winners: useLegacyLiveData ? legacyData.winners ?? [] : eventData.winners ?? [],
    attendees: useLegacyLiveData ? legacyData.attendees ?? [] : eventData.attendees ?? [],
    attendeeProgress: useLegacyLiveData
      ? legacyData.attendeeProgress ?? {}
      : eventData.attendeeProgress ?? {},
    attendeeLocation: useLegacyLiveData
      ? legacyData.attendeeLocation ?? {}
      : eventData.attendeeLocation ?? {},
  }
  const syncUpdatedAt = getAssetSettingUpdatedAt(
    mergedSettings.mapSrc,
    eventData.settings?.mapSrc,
    legacyData.settings?.mapSrc,
    eventUpdatedAt,
    legacyUpdatedAt,
  )

  return attachRemoteMeta(merged, syncUpdatedAt)
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

  const { accessToken, headers, ...fetchOptions } = options
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...fetchOptions,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: accessToken
          ? `Bearer ${accessToken}`
          : `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...headers,
      },
    })

    if (!response.ok) {
      const detail = await response.text()
      const error = new Error(`Supabase request failed: ${response.status} ${detail}`)
      error.status = response.status
      throw error
    }

    if (response.status === 204) return null

    const text = await response.text()
    if (!text.trim()) return null

    return JSON.parse(text)
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Supabase request timed out.')
      timeoutError.status = 408
      throw timeoutError
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function boothRowToClient(row) {
  return {
    id: row.id,
    name: row.name ?? '',
    category: row.category ?? '',
    location: row.location ?? '',
    description: row.description ?? '',
    websiteUrl: row.website_url ?? '',
    logoDataUrl: row.logo_url ?? '',
    qrCode: row.qr_code ?? '',
    color: row.color ?? '#6b7280',
    logoColor: row.logo_color ?? row.color ?? '#007b70',
    logoBackgroundColor: row.logo_background_color ?? '#ffffff',
    map: {
      x: Number(row.map_x ?? 50),
      y: Number(row.map_y ?? 50),
    },
  }
}

function settingsRowToClient(row) {
  if (!row) return null

  return {
    requiredScanCount: row.required_scan_count ?? 1,
    instructions: row.instructions ?? [],
    mapSrc: row.map_src ?? '',
    homeImageSrc: row.home_image_src ?? '',
    raffleCompleteImageSrc: row.raffle_complete_image_src ?? '',
    boothCategories: row.booth_categories ?? [],
    termsText: row.terms_text ?? '',
  }
}

function mergeBoothQrCodes(publicBooths, adminBooths) {
  const adminById = new Map((adminBooths ?? []).map((booth) => [booth.id, booth]))

  return publicBooths.map((booth) => {
    const admin = adminById.get(booth.id)
    if (!admin) return booth

    return {
      ...booth,
      qrCode: admin.qrCode ?? booth.qrCode ?? '',
      logoColor: booth.logoColor || admin.logoColor || admin.color || booth.color,
      logoBackgroundColor: booth.logoBackgroundColor || admin.logoBackgroundColor,
    }
  })
}

async function loadPublicEventData(eventId) {
  const [boothRows, settingsRows] = await Promise.all([
    requestSupabase(
      `public_event_booths?event_id=eq.${encodeURIComponent(eventId)}&select=*`,
    ),
    requestSupabase(
      `public_event_settings?event_id=eq.${encodeURIComponent(eventId)}&select=*&limit=1`,
    ),
  ])

  return {
    booths: (boothRows ?? []).map(boothRowToClient),
    settings: settingsRowToClient(settingsRows?.[0]) ?? getEventBaseState(eventId).settings,
    entries: [],
    winners: [],
    attendees: [],
    attendeeProgress: {},
    attendeeLocation: {},
  }
}

async function loadAttendeeScopedData(eventId, accessToken) {
  const attendees = await requestSupabase(
    `attendees?event_id=eq.${encodeURIComponent(eventId)}&select=*`,
    { accessToken },
  )

  if (!attendees?.length) return null

  const attendee = attendees[0]
  const [scans, locations, entries] = await Promise.all([
    requestSupabase(
      `scans?attendee_id=eq.${encodeURIComponent(attendee.id)}&select=booth_id,scanned_at&order=scanned_at.asc`,
      { accessToken },
    ),
    requestSupabase(
      `attendee_locations?attendee_id=eq.${encodeURIComponent(attendee.id)}&select=booth_id&limit=1`,
      { accessToken },
    ),
    requestSupabase(
      `entries?event_id=eq.${encodeURIComponent(eventId)}&select=*`,
      { accessToken },
    ),
  ])

  const completedIds = (scans ?? []).map((scan) => scan.booth_id)

  return {
    attendees: [
      {
        id: attendee.id,
        name: attendee.name,
        email: attendee.email,
        phone: attendee.phone,
        role: attendee.role,
        acceptedTermsAt: attendee.terms_accepted_at,
        createdAt: attendee.created_at,
      },
    ],
    attendeeProgress: {
      [attendee.id]: completedIds,
    },
    attendeeLocation: locations?.[0]?.booth_id
      ? { [attendee.id]: locations[0].booth_id }
      : {},
    entries: (entries ?? []).map((entry) => ({
      id: entry.id,
      attendeeId: entry.attendee_id ?? '',
      name: entry.name,
      email: entry.email,
      phone: entry.phone,
      role: entry.role,
      chances: entry.chances,
      submittedAt: entry.submitted_at,
      manual: entry.is_manual,
    })),
    winners: [],
  }
}

async function loadAdminSharedData(eventId, adminAccessToken) {
  const result = await requestWriteProxy(
    {
      action: 'load_shared',
      eventId,
    },
    { adminAccessToken },
  )

  return result.data ?? null
}

async function loadRemoteSharedLegacy(eventId = DEFAULT_EVENT_ID) {
  const eventRowPromise = requestSupabase(
    `${SUPABASE_TABLE}?id=eq.${getSharedRowId(eventId)}&select=data,updated_at&limit=1`,
  )
  const legacyRowPromise =
    eventId === DEFAULT_EVENT_ID
      ? requestSupabase(
          `${SUPABASE_TABLE}?id=eq.${SHARED_ROW_ID}&select=data,updated_at&limit=1`,
        )
      : Promise.resolve(null)

  const [rows, legacyRows] = await Promise.all([eventRowPromise, legacyRowPromise])
  const row = rows?.[0] ?? null
  const eventData = row?.data ?? null
  const remoteUpdatedAt = row?.updated_at ?? null

  if (eventId === DEFAULT_EVENT_ID) {
    const legacyRow = legacyRows?.[0] ?? null
    const legacyData = legacyRow?.data ?? null
    const legacyUpdatedAt = legacyRow?.updated_at ?? null
    return mergeDefaultEventShared(eventData, remoteUpdatedAt, legacyData, legacyUpdatedAt)
  }

  if (eventData && !hasLiveEventData(eventData) && looksLikeDefaultEventClone(eventData)) {
    return getPlaceholderEventState()
  }

  if (eventData) return attachRemoteMeta(eventData, remoteUpdatedAt)
  return null
}

async function loadRemoteShared(eventId = DEFAULT_EVENT_ID, readContext = {}) {
  if (!isNormalizedReadsEnabled()) {
    return loadRemoteSharedLegacy(eventId)
  }

  try {
    const context = await getReadContext(readContext)
    const publicData = await loadPublicEventData(eventId)
    let merged = { ...publicData }

    if (context.adminAccessToken) {
      const adminData = await loadAdminSharedData(eventId, context.adminAccessToken)
      if (adminData) {
        merged = {
          ...merged,
          booths: adminData.booths?.length
            ? mergeBoothQrCodes(publicData.booths, adminData.booths)
            : merged.booths,
          settings: { ...merged.settings, ...adminData.settings },
          entries: adminData.entries ?? [],
          winners: adminData.winners ?? [],
          attendees: adminData.attendees ?? [],
          attendeeProgress: adminData.attendeeProgress ?? {},
          attendeeLocation: adminData.attendeeLocation ?? {},
        }
      }
    } else if (context.attendeeAccessToken) {
      const attendeeData = await loadAttendeeScopedData(eventId, context.attendeeAccessToken)
      if (attendeeData) {
        merged = {
          ...merged,
          ...attendeeData,
        }
      }
    }

    return attachRemoteMeta(merged, new Date().toISOString())
  } catch (error) {
    console.warn(error)
    return loadRemoteSharedLegacy(eventId)
  }
}

export const passportRepository = {
  defaultEvent,
  load() {
    return loadLocalShell()
  },
  save(state) {
    writeState(state)
  },
  isCloudFirstEnabled,
  bootstrapFromRemote,
  mergeShared(state, sharedState, options) {
    return mergeSharedState(state, sharedState, options)
  },
  getInitialEventState,
  getPlaceholderEventState,
  getEventBaseState,
  getActiveEventId,
  async loadEventIndex() {
    return loadRemoteEventIndex()
  },
  async saveEventIndex(events) {
    try {
      if (isWriteProxyEnabled()) {
        await requestWriteProxy({
          action: 'save_events',
          events: normalizeEvents(events),
        })
        return
      }

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
  async loadShared(eventId = DEFAULT_EVENT_ID, readContext = {}) {
    try {
      return loadRemoteShared(eventId, readContext)
    } catch (error) {
      console.warn(error)
      return null
    }
  },
  isNormalizedReadsEnabled,
  async saveShared(state) {
    try {
      if (isWriteProxyEnabled()) {
        await requestWriteProxy({
          action: 'replace',
          eventId: state.activeEventId,
          data: getSharedState(state),
        })
        return
      }

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
  async saveSharedPatch(patch, eventId = DEFAULT_EVENT_ID, options = {}) {
    try {
      if (isWriteProxyEnabled()) {
        await requestWriteProxy({
          action: 'patch',
          eventId,
          patch,
          scanToken: options.scanToken,
          idempotencyKey: options.idempotencyKey,
        })
        return { ok: true, queued: false }
      }

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
        queueSharedPatch(patch, eventId, {
          scanToken: options.scanToken,
          idempotencyKey: options.idempotencyKey,
        })
        return { ok: false, queued: true }
      }
      return { ok: false, queued: false }
    }
  },
  async recordScan({
    eventId = DEFAULT_EVENT_ID,
    attendeeId,
    boothId,
    scanToken,
    idempotencyKey,
  }) {
    if (!isWriteProxyEnabled() || !isSignedScanEnabled()) {
      return { ok: false, message: 'Signed scan recording is not enabled.' }
    }

    try {
      const result = await requestRecordScan({
        eventId,
        attendeeId,
        boothId,
        scanToken,
        idempotencyKey: idempotencyKey ?? crypto.randomUUID(),
      })
      return { ok: true, ...result }
    } catch (error) {
      console.warn(error)
      if (shouldQueueSupabaseError(error)) {
        queueSharedPatch(null, eventId, {
          recordScan: true,
          attendeeId,
          boothId,
          scanToken,
          idempotencyKey,
        })
        return { ok: false, queued: true, duplicate: error.duplicate }
      }
      return { ok: false, queued: false, message: error.message, duplicate: error.duplicate }
    }
  },
  isSignedScanEnabled,
  getOfflineQueueStatus,
  async flushOfflineQueue() {
    const queue = readOfflineQueue()
    if (!queue.length) return getOfflineQueueStatus()
    if (!isSupabaseConfigured() || !getOnlineStatus()) return getOfflineQueueStatus()

    const remaining = []

    for (const queuedPatch of queue) {
      try {
        if (queuedPatch.recordScan && isSignedScanEnabled()) {
          await requestRecordScan({
            eventId: queuedPatch.eventId,
            attendeeId: queuedPatch.attendeeId,
            boothId: queuedPatch.boothId,
            scanToken: queuedPatch.scanToken,
            idempotencyKey: queuedPatch.idempotencyKey,
          })
          continue
        }

        if (!queuedPatch.patch) {
          continue
        }

        if (isWriteProxyEnabled()) {
          await requestWriteProxy({
            action: 'patch',
            eventId: queuedPatch.eventId,
            patch: queuedPatch.patch,
            scanToken: queuedPatch.scanToken,
            idempotencyKey: queuedPatch.idempotencyKey,
          })
          continue
        }

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
