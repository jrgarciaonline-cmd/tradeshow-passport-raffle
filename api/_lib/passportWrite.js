import {
  dualWriteEventIndex,
  dualWriteFullState,
  dualWritePatch,
  recordNormalizedScan,
} from './normalizedWrite.js'
import { assertValidScanToken } from './scanToken.js'
import {
  getAdminUser,
  requestSupabase,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
} from './supabaseAdmin.js'

const PASSPORT_TABLE = 'passport_state'
const EVENTS_ROW_ID = 'events'

const ADMIN_PATCH_KEYS = new Set(['booths', 'settings', 'winners'])
const PUBLIC_PATCH_KEYS = new Set([
  'attendees',
  'attendeeProgress',
  'attendeeLocation',
  'entries',
])

function getSharedRowId(eventId) {
  return `event:${eventId}`
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

export function mergeSharedPatch(sharedState, patch) {
  const currentSharedState = sharedState ?? {
    booths: [],
    entries: [],
    winners: [],
    attendees: [],
    attendeeProgress: {},
    attendeeLocation: {},
    settings: {},
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

export function classifyPatch(patch) {
  const keys = Object.keys(patch ?? {}).filter(
    (key) => !['entriesReplace', 'winnersReplace'].includes(key),
  )

  if (keys.some((key) => ADMIN_PATCH_KEYS.has(key))) {
    return 'admin'
  }

  if (patch.entriesReplace || patch.winnersReplace) {
    return 'admin'
  }

  if (patch.entries && (!Array.isArray(patch.entries) || patch.entries.length !== 1)) {
    return 'admin'
  }

  if (!keys.length || keys.every((key) => PUBLIC_PATCH_KEYS.has(key))) {
    return 'public'
  }

  return 'invalid'
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

function validateAttendeeRecord(attendee) {
  const email = normalizeEmail(attendee?.email)
  const name = String(attendee?.name ?? '').trim()
  const phone = String(attendee?.phone ?? '').trim()
  const role = String(attendee?.role ?? '').trim()

  if (!attendee?.id || !name || !email || !phone || !role) {
    throw new Error('Attendee registration is missing required fields.')
  }

  if (!email.includes('@')) {
    throw new Error('Attendee registration requires a valid email.')
  }
}

function validatePublicPatch(patch, sharedState, options = {}) {
  const keys = Object.keys(patch).filter(
    (key) => !['entriesReplace', 'winnersReplace'].includes(key),
  )

  if (keys.some((key) => ADMIN_PATCH_KEYS.has(key))) {
    throw new Error('This update requires admin authorization.')
  }

  if (patch.entriesReplace || patch.winnersReplace) {
    throw new Error('This update requires admin authorization.')
  }

  if (patch.attendees) {
    if (!Array.isArray(patch.attendees) || patch.attendees.length !== 1) {
      throw new Error('Attendee registration must include exactly one attendee.')
    }

    validateAttendeeRecord(patch.attendees[0])
  }

  if (patch.entries) {
    if (!Array.isArray(patch.entries) || patch.entries.length !== 1) {
      throw new Error('Raffle entry must include exactly one entry.')
    }

    const entry = patch.entries[0]
    const attendee = sharedState.attendees?.find((item) => item.id === entry.attendeeId)

    if (!attendee) {
      throw new Error('Attendee must register before entering the raffle.')
    }

    const existingEntry = sharedState.entries?.find(
      (item) => item.attendeeId === entry.attendeeId || item.email === attendee.email,
    )

    if (existingEntry) {
      throw new Error('This attendee is already entered in the raffle.')
    }

    const requiredScanCount = Math.max(1, Number(sharedState.settings?.requiredScanCount) || 1)
    const completedIds = sharedState.attendeeProgress?.[entry.attendeeId] ?? []

    if (completedIds.length < requiredScanCount) {
      throw new Error('Attendee has not completed the required number of scans.')
    }
  }

  if (patch.attendeeProgress) {
    const attendeeIds = Object.keys(patch.attendeeProgress)

    if (attendeeIds.length !== 1) {
      throw new Error('Scan updates must target exactly one attendee.')
    }

    const boothIds = new Set((sharedState.booths ?? []).map((booth) => booth.id))
    const progress = patch.attendeeProgress[attendeeIds[0]]

    if (!Array.isArray(progress)) {
      throw new Error('Scan progress must be an array of booth ids.')
    }

    if (progress.some((boothId) => !boothIds.has(boothId))) {
      throw new Error('Scan progress includes an unknown booth.')
    }

    if (options.scanToken) {
      const latestBoothId = progress.at(-1)
      assertValidScanToken(options.scanToken, {
        eventId: options.eventId,
        boothId: latestBoothId,
      })
    }
  }

  if (patch.attendeeLocation) {
    const attendeeIds = Object.keys(patch.attendeeLocation)

    if (attendeeIds.length !== 1) {
      throw new Error('Location updates must target exactly one attendee.')
    }

    const boothId = patch.attendeeLocation[attendeeIds[0]]
    const boothIds = new Set((sharedState.booths ?? []).map((booth) => booth.id))

    if (boothId && !boothIds.has(boothId)) {
      throw new Error('Location update references an unknown booth.')
    }
  }
}

export async function getRequestingAdmin(accessToken) {
  if (!accessToken) return null

  const user = await requestSupabase('/auth/v1/user', SUPABASE_ANON_KEY, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const email = user?.email?.trim().toLowerCase()
  if (!email) return null

  const adminUser = await getAdminUser(email)
  if (!adminUser) return null

  return adminUser
}

export async function loadSharedState(eventId) {
  const rows = await requestSupabase(
    `/rest/v1/${PASSPORT_TABLE}?id=eq.${encodeURIComponent(getSharedRowId(eventId))}&select=data&limit=1`,
    SUPABASE_SERVICE_ROLE_KEY,
  )

  return rows?.[0]?.data ?? null
}

export async function saveSharedState(eventId, data, options = {}) {
  await requestSupabase(`/rest/v1/${PASSPORT_TABLE}?on_conflict=id`, SUPABASE_SERVICE_ROLE_KEY, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: getSharedRowId(eventId),
      data,
      updated_at: new Date().toISOString(),
    }),
  })

  if (options.dualWriteFull) {
    await dualWriteFullState(eventId, data).catch((error) => {
      console.warn('Normalized dual-write failed:', error.message)
    })
  }
}

export async function loadEventIndex() {
  const rows = await requestSupabase(
    `/rest/v1/${PASSPORT_TABLE}?id=eq.${EVENTS_ROW_ID}&select=data&limit=1`,
    SUPABASE_SERVICE_ROLE_KEY,
  )

  return rows?.[0]?.data?.events ?? []
}

export async function saveEventIndex(events) {
  await requestSupabase(`/rest/v1/${PASSPORT_TABLE}?on_conflict=id`, SUPABASE_SERVICE_ROLE_KEY, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: EVENTS_ROW_ID,
      data: { events },
      updated_at: new Date().toISOString(),
    }),
  })

  await dualWriteEventIndex(events).catch((error) => {
    console.warn('Normalized event index dual-write failed:', error.message)
  })
}

export async function applyValidatedPatch({
  eventId,
  patch,
  adminAccessToken,
  scanToken,
  idempotencyKey,
}) {
  const patchType = classifyPatch(patch)

  if (patchType === 'invalid') {
    throw new Error('Patch contains unsupported fields.')
  }

  const sharedState = await loadSharedState(eventId)

  if (patchType === 'admin') {
    const adminUser = await getRequestingAdmin(adminAccessToken)

    if (!adminUser) {
      const error = new Error('Admin authorization is required for this update.')
      error.status = 403
      throw error
    }
  } else {
    validatePublicPatch(patch, sharedState ?? {}, { scanToken, eventId })
  }

  const nextSharedState = mergeSharedPatch(sharedState, patch)
  await saveSharedState(eventId, nextSharedState)

  await dualWritePatch(eventId, patch, nextSharedState).catch((error) => {
    console.warn('Normalized patch dual-write failed:', error.message)
  })

  if (patch.attendeeProgress) {
    const attendeeId = Object.keys(patch.attendeeProgress)[0]
    const boothId = patch.attendeeProgress[attendeeId]?.at(-1)

    if (attendeeId && boothId) {
      await recordNormalizedScan({
        eventId,
        attendeeId,
        boothId,
        idempotencyKey,
      }).catch((error) => {
        console.warn('Normalized scan record failed:', error.message)
      })
    }
  }

  return nextSharedState
}

export async function getAuthUser(accessToken) {
  if (!accessToken) return null

  const user = await requestSupabase('/auth/v1/user', SUPABASE_ANON_KEY, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!user?.id) return null
  return user
}

async function linkAttendeeAuthUserRecord({ eventId, attendeeId, authUserId }) {
  try {
    await requestSupabase(
      `/rest/v1/attendees?id=eq.${encodeURIComponent(attendeeId)}&event_id=eq.${encodeURIComponent(eventId)}`,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ auth_user_id: authUserId }),
      },
    )
  } catch (error) {
    console.warn('Attendee auth link skipped:', error.message)
  }
}

export async function completeAttendeeAuth({ eventId, accessToken }) {
  const user = await getAuthUser(accessToken)
  if (!user?.email) {
    const error = new Error('Valid attendee authentication is required.')
    error.status = 403
    throw error
  }

  const email = user.email.trim().toLowerCase()
  const sharedState = await loadSharedState(eventId)
  const attendee = sharedState?.attendees?.find((item) => item.email === email)

  if (!attendee) {
    const error = new Error('No passport found for this email. Please sign up first.')
    error.status = 404
    throw error
  }

  await linkAttendeeAuthUserRecord({
    eventId,
    attendeeId: attendee.id,
    authUserId: user.id,
  })

  const completedIds = sharedState?.attendeeProgress?.[attendee.id] ?? []

  return {
    attendee,
    completedIds,
    attendeeProgress: {
      [attendee.id]: completedIds,
    },
    attendeeLocation: sharedState?.attendeeLocation?.[attendee.id]
      ? { [attendee.id]: sharedState.attendeeLocation[attendee.id] }
      : {},
  }
}

export async function recordScan({
  eventId,
  attendeeId,
  boothId,
  scanToken,
  idempotencyKey,
}) {
  const sharedState = await loadSharedState(eventId)
  const boothIds = new Set((sharedState?.booths ?? []).map((booth) => booth.id))

  if (!boothIds.has(boothId)) {
    throw new Error('Scan references an unknown booth.')
  }

  const attendee = sharedState?.attendees?.find((item) => item.id === attendeeId)
  if (!attendee) {
    throw new Error('Attendee must register before scanning.')
  }

  assertValidScanToken(scanToken, { eventId, boothId })

  const currentProgress = sharedState?.attendeeProgress?.[attendeeId] ?? []
  if (currentProgress.includes(boothId)) {
    return {
      duplicate: true,
      completedIds: currentProgress,
    }
  }

  const completedIds = [...currentProgress, boothId]
  const patch = {
    attendeeProgress: {
      [attendeeId]: completedIds,
    },
    attendeeLocation: {
      [attendeeId]: boothId,
    },
  }

  await applyValidatedPatch({
    eventId,
    patch,
    scanToken,
    idempotencyKey,
  })

  return {
    duplicate: false,
    completedIds,
  }
}
