import { requestSupabase, SUPABASE_SERVICE_ROLE_KEY } from './supabaseAdmin.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isNormalizedDualWriteEnabled() {
  return process.env.NORMALIZED_DUAL_WRITE === 'true'
}

function upsertRows(table, rows, onConflict) {
  if (!rows.length) return Promise.resolve()

  return requestSupabase(`/rest/v1/${table}?on_conflict=${onConflict}`, SUPABASE_SERVICE_ROLE_KEY, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
}

function replaceRows(table, filter, rows) {
  const deletePromise = requestSupabase(
    `/rest/v1/${table}?${filter}`,
    SUPABASE_SERVICE_ROLE_KEY,
    { method: 'DELETE' },
  )

  if (!rows.length) return deletePromise
  return deletePromise.then(() => upsertRows(table, rows, getConflictKey(table)))
}

function getConflictKey(table) {
  if (table === 'booths') return 'event_id,id'
  if (table === 'events') return 'id'
  if (table === 'event_settings') return 'event_id'
  if (table === 'attendees') return 'event_id,email'
  if (table === 'scans') return 'id'
  if (table === 'entries') return 'event_id,email'
  if (table === 'winners') return 'id'
  if (table === 'attendee_locations') return 'attendee_id'
  return 'id'
}

function dedupeByEmail(rows) {
  const byEmail = new Map()
  for (const row of rows) {
    byEmail.set(row.email, row)
  }
  return [...byEmail.values()]
}

function resolveForeignId(id, validIds) {
  return id && validIds.has(id) ? id : null
}

function boothToRow(eventId, booth) {
  return {
    event_id: eventId,
    id: booth.id,
    name: booth.name ?? '',
    category: booth.category ?? '',
    location: booth.location ?? '',
    description: booth.description ?? '',
    website_url: booth.websiteUrl ?? '',
    logo_url: booth.logoDataUrl ?? '',
    qr_code: booth.qrCode ?? '',
    color: booth.color ?? '#6b7280',
    map_x: booth.map?.x ?? 50,
    map_y: booth.map?.y ?? 50,
    updated_at: new Date().toISOString(),
  }
}

function settingsToRow(eventId, settings = {}) {
  return {
    event_id: eventId,
    required_scan_count: Math.max(1, Number(settings.requiredScanCount) || 1),
    instructions: settings.instructions ?? [],
    map_src: settings.mapSrc ?? '',
    home_image_src: settings.homeImageSrc ?? '',
    raffle_complete_image_src: settings.raffleCompleteImageSrc ?? '',
    booth_categories: settings.boothCategories ?? [],
    terms_text: settings.termsText ?? '',
    updated_at: new Date().toISOString(),
  }
}

function attendeeToRow(eventId, attendee) {
  return {
    id: attendee.id,
    event_id: eventId,
    name: attendee.name ?? '',
    email: String(attendee.email ?? '').trim().toLowerCase(),
    phone: attendee.phone ?? '',
    role: attendee.role ?? '',
    terms_accepted_at: attendee.acceptedTermsAt ?? attendee.createdAt ?? null,
    created_at: attendee.createdAt ?? new Date().toISOString(),
  }
}

function entryToRow(eventId, entry) {
  return {
    id: entry.id,
    event_id: eventId,
    attendee_id: entry.attendeeId || null,
    name: entry.name ?? '',
    email: String(entry.email ?? '').trim().toLowerCase(),
    phone: entry.phone ?? '',
    role: entry.role ?? '',
    chances: Math.max(1, Math.min(99, Number(entry.chances) || 1)),
    is_manual: Boolean(entry.manual),
    submitted_at: entry.submittedAt ?? new Date().toISOString(),
  }
}

function winnerToRow(eventId, winner) {
  return {
    id: winner.id,
    event_id: eventId,
    entry_id: winner.entryId ?? null,
    attendee_id: winner.attendeeId ?? '',
    name: winner.name ?? '',
    email: String(winner.email ?? '').trim().toLowerCase(),
    phone: winner.phone ?? '',
    role: winner.role ?? '',
    chances: Math.max(1, Number(winner.chances) || 1),
    picked_at: winner.pickedAt ?? new Date().toISOString(),
  }
}

export async function dualWriteEventIndex(events = []) {
  if (!isNormalizedDualWriteEnabled()) return
  await syncEventIndex(events)
}

export async function backfillEventIndex(events = []) {
  await syncEventIndex(events)
}

async function syncEventIndex(events = []) {
  const rows = events.map((event) => ({
    id: event.id,
    name: event.name ?? 'Untitled Event',
    status: event.status ?? 'active',
    created_at: event.createdAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

  await upsertRows('events', rows, 'id')
}

export async function dualWriteFullState(eventId, data) {
  if (!isNormalizedDualWriteEnabled() || !eventId || !data) return
  await syncFullState(eventId, data)
}

export async function backfillFullState(eventId, data) {
  if (!eventId || !data) return
  await syncFullState(eventId, data)
}

async function syncFullState(eventId, data) {
  await upsertRows(
    'events',
    [
      {
        id: eventId,
        name: data.eventName ?? eventId,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
    ],
    'id',
  )

  const boothRows = (data.booths ?? []).map((booth) => boothToRow(eventId, booth))
  await replaceRows('booths', `event_id=eq.${encodeURIComponent(eventId)}`, boothRows)
  await upsertRows('event_settings', [settingsToRow(eventId, data.settings)], 'event_id')

  const attendeeRows = dedupeByEmail(
    (data.attendees ?? [])
      .filter((attendee) => isUuid(attendee.id))
      .map((attendee) => attendeeToRow(eventId, attendee)),
  )
  await upsertRows('attendees', attendeeRows, 'event_id,email')
  const syncedAttendeeIds = new Set(attendeeRows.map((row) => row.id))

  const scanRows = []
  for (const [attendeeId, boothIds] of Object.entries(data.attendeeProgress ?? {})) {
    if (!syncedAttendeeIds.has(attendeeId) || !Array.isArray(boothIds)) continue
    for (const boothId of boothIds) {
      scanRows.push({
        event_id: eventId,
        attendee_id: attendeeId,
        booth_id: boothId,
        scanned_at: new Date().toISOString(),
      })
    }
  }
  if (scanRows.length) {
    await upsertRows('scans', scanRows, 'attendee_id,booth_id')
  }

  const locationRows = Object.entries(data.attendeeLocation ?? {})
    .filter(([attendeeId]) => syncedAttendeeIds.has(attendeeId))
    .map(([attendeeId, boothId]) => ({
      attendee_id: attendeeId,
      booth_id: boothId ?? '',
      updated_at: new Date().toISOString(),
    }))
  if (locationRows.length) {
    await upsertRows('attendee_locations', locationRows, 'attendee_id')
  }

  const entryRows = dedupeByEmail(
    (data.entries ?? [])
      .filter((entry) => isUuid(entry.id) && (!entry.attendeeId || isUuid(entry.attendeeId)))
      .map((entry) => entryToRow(eventId, entry))
      .map((row) => ({
        ...row,
        attendee_id: resolveForeignId(row.attendee_id, syncedAttendeeIds),
      })),
  )
  await upsertRows('entries', entryRows, 'event_id,email')
  const syncedEntryIds = new Set(entryRows.map((row) => row.id))

  const winnerRows = (data.winners ?? [])
    .filter(
      (winner) =>
        isUuid(winner.id) && (!winner.entryId || isUuid(winner.entryId)),
    )
    .map((winner) => winnerToRow(eventId, winner))
    .map((row) => ({
      ...row,
      entry_id: resolveForeignId(row.entry_id, syncedEntryIds),
    }))
  await upsertRows('winners', winnerRows, 'id')
}

export async function dualWritePatch(eventId, patch, mergedState) {
  if (!isNormalizedDualWriteEnabled() || !eventId) return

  if (patch.booths) {
    const boothRows = patch.booths.map((booth) => boothToRow(eventId, booth))
    await upsertRows('booths', boothRows, 'event_id,id')
  }

  if (patch.settings) {
    await upsertRows(
      'event_settings',
      [settingsToRow(eventId, { ...mergedState.settings, ...patch.settings })],
      'event_id',
    )
  }

  if (patch.attendees?.length) {
    const attendeeRows = patch.attendees
      .filter((attendee) => isUuid(attendee.id))
      .map((attendee) => attendeeToRow(eventId, attendee))
    if (attendeeRows.length) {
      await upsertRows('attendees', dedupeByEmail(attendeeRows), 'event_id,email')
    }
  }

  if (patch.attendeeProgress) {
    for (const [attendeeId, boothIds] of Object.entries(patch.attendeeProgress)) {
      if (!isUuid(attendeeId) || !Array.isArray(boothIds)) continue
      const latestBoothId = boothIds.at(-1)
      if (latestBoothId) {
        await upsertRows(
          'scans',
          [
            {
              event_id: eventId,
              attendee_id: attendeeId,
              booth_id: latestBoothId,
              scanned_at: new Date().toISOString(),
            },
          ],
          'attendee_id,booth_id',
        )
      }
    }
  }

  if (patch.attendeeLocation) {
    const locationRows = Object.entries(patch.attendeeLocation)
      .filter(([attendeeId]) => isUuid(attendeeId))
      .map(([attendeeId, boothId]) => ({
        attendee_id: attendeeId,
        booth_id: boothId ?? '',
        updated_at: new Date().toISOString(),
      }))
    if (locationRows.length) {
      await upsertRows('attendee_locations', locationRows, 'attendee_id')
    }
  }

  if (patch.entries?.length) {
    const entryRows = patch.entries
      .filter((entry) => isUuid(entry.id) && (!entry.attendeeId || isUuid(entry.attendeeId)))
      .map((entry) => entryToRow(eventId, entry))
    if (entryRows.length) {
      await upsertRows('entries', dedupeByEmail(entryRows), 'event_id,email')
    }
  }

  if (patch.entriesReplace) {
    await replaceRows(
      'entries',
      `event_id=eq.${encodeURIComponent(eventId)}`,
      dedupeByEmail(
        (mergedState.entries ?? [])
          .filter((entry) => isUuid(entry.id) && (!entry.attendeeId || isUuid(entry.attendeeId)))
          .map((entry) => entryToRow(eventId, entry)),
      ),
    )
  }

  if (patch.winners?.length) {
    const winnerRows = patch.winners
      .filter(
        (winner) =>
          isUuid(winner.id) && (!winner.entryId || isUuid(winner.entryId)),
      )
      .map((winner) => winnerToRow(eventId, winner))
    if (winnerRows.length) {
      await upsertRows('winners', winnerRows, 'id')
    }
  }

  if (patch.winnersReplace) {
    await replaceRows(
      'winners',
      `event_id=eq.${encodeURIComponent(eventId)}`,
      (mergedState.winners ?? [])
        .filter(
          (winner) =>
            isUuid(winner.id) && (!winner.entryId || isUuid(winner.entryId)),
        )
        .map((winner) => winnerToRow(eventId, winner)),
    )
  }
}

export async function recordNormalizedScan({
  eventId,
  attendeeId,
  boothId,
  idempotencyKey,
  scannedAt,
}) {
  if (!isNormalizedDualWriteEnabled() || !isUuid(attendeeId)) return

  const row = {
    event_id: eventId,
    attendee_id: attendeeId,
    booth_id: boothId,
    scanned_at: scannedAt ?? new Date().toISOString(),
  }

  if (idempotencyKey) {
    row.idempotency_key = idempotencyKey
  }

  await upsertRows('scans', [row], 'attendee_id,booth_id')
}
