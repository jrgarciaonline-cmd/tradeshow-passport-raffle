#!/usr/bin/env node
/**
 * Backfill normalized Plan 3 tables from passport_state JSON rows.
 *
 * Usage:
 *   node scripts/backfill-normalized-schema.mjs
 *   node scripts/backfill-normalized-schema.mjs --event-id=landfx-passport-raffle
 *
 * Requires SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { loadEnvFile } from './load-env.mjs'

loadEnvFile()

const { backfillEventIndex, backfillFullState } = await import('../api/_lib/normalizedWrite.js')
const { requestSupabase, SUPABASE_SERVICE_ROLE_KEY } = await import('../api/_lib/supabaseAdmin.js')

const PASSPORT_TABLE = 'passport_state'
const EVENTS_ROW_ID = 'events'

function getArg(name) {
  const prefix = `--${name}=`
  const match = process.argv.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : null
}

function getSharedRowId(eventId) {
  return `event:${eventId}`
}

async function loadPassportRows() {
  return requestSupabase(
    `/rest/v1/${PASSPORT_TABLE}?select=id,data,updated_at`,
    SUPABASE_SERVICE_ROLE_KEY,
  )
}

async function main() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY in environment.')
    process.exit(1)
  }

  const onlyEventId = getArg('event-id')
  const rows = await loadPassportRows()
  const eventsRow = rows.find((row) => row.id === EVENTS_ROW_ID)
  const events = eventsRow?.data?.events ?? []

  console.log(`Found ${events.length} event(s) in passport_state index.`)

  if (events.length) {
    await backfillEventIndex(events)
    console.log('Synced events table.')
  }

  const eventRows = rows.filter((row) => row.id.startsWith('event:'))

  for (const row of eventRows) {
    const eventId = row.id.slice('event:'.length)
    if (onlyEventId && eventId !== onlyEventId) continue

    const eventMeta = events.find((event) => event.id === eventId)
    const data = {
      ...row.data,
      eventName: eventMeta?.name ?? eventId,
    }

    await backfillFullState(eventId, data)
    console.log(`Backfilled event:${eventId}`)
  }

  console.log('Backfill complete. Enable NORMALIZED_DUAL_WRITE=true after verifying row counts.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
