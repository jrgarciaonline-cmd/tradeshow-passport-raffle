#!/usr/bin/env node
/**
 * Load test for scan recording via the write proxy.
 *
 * Usage:
 *   node scripts/load-test-scans.mjs --url=https://your-app.vercel.app --event-id=landfx-passport-raffle
 *   node scripts/load-test-scans.mjs --url=... --booth-id=hunter --requests=200
 *
 * Booth id must exist on the event (default: hunter for landfx-passport-raffle).
 * Use --mode=record-scan only with pre-registered attendee ids and signed tokens.
 */

import { loadEnvFile } from './load-env.mjs'
import { signScanToken } from '../api/_lib/scanToken.js'

loadEnvFile()

function getArg(name, fallback = '') {
  const prefix = `--${name}=`
  const match = process.argv.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : fallback
}

const baseUrl = getArg('url', 'http://127.0.0.1:3001').replace(/\/$/, '')
const eventId = getArg('event-id', 'landfx-passport-raffle')
const boothId = getArg('booth-id', 'hunter')
const totalRequests = Math.max(1, Number(getArg('requests', '200')) || 200)
const concurrency = Math.max(1, Number(getArg('concurrency', '20')) || 20)
const useRecordScan = getArg('mode', 'patch') === 'record-scan'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

async function verifyBoothExists() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Skipping booth verification (Supabase env not loaded).')
    return
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/public_event_booths?event_id=eq.${encodeURIComponent(eventId)}&id=eq.${encodeURIComponent(boothId)}&select=id,name&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  )

  if (!response.ok) {
    console.warn('Could not verify booth id against public_event_booths.')
    return
  }

  const rows = await response.json()
  if (!rows?.length) {
    const listResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/public_event_booths?event_id=eq.${encodeURIComponent(eventId)}&select=id,name&limit=10`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    )
    const available = listResponse.ok ? await listResponse.json() : []
    const ids = available.map((row) => row.id).join(', ') || '(none found)'
    console.error(
      `Booth "${boothId}" was not found on event "${eventId}". Available ids: ${ids}`,
    )
    console.error('Re-run with --booth-id=<valid-id>')
    process.exit(1)
  }

  console.log(`Using booth: ${rows[0].name} (${rows[0].id})`)
}

async function buildPayload(index) {
  const attendeeId = crypto.randomUUID()
  const scanToken =
    process.env.SCAN_SIGNING_SECRET?.trim()
      ? signScanToken({ eventId, boothId })
      : `LOADTEST-${index}`

  if (useRecordScan) {
    return {
      path: '/api/record-scan',
      body: {
        eventId,
        attendeeId,
        boothId,
        scanToken,
        idempotencyKey: crypto.randomUUID(),
      },
    }
  }

  return {
    path: '/api/passport-write',
    body: {
      action: 'patch',
      eventId,
      patch: {
        attendees: [
          {
            id: attendeeId,
            name: `Load Test ${index}`,
            email: `loadtest-${index}-${Date.now()}@example.com`,
            phone: '5555550100',
            role: 'Student',
            acceptedTermsAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
        attendeeProgress: {
          [attendeeId]: [boothId],
        },
      },
      scanToken: process.env.SCAN_SIGNING_SECRET ? scanToken : undefined,
    },
  }
}

async function sendRequest(index) {
  const started = performance.now()
  const { path, body } = await buildPayload(index)

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await response.json().catch(() => ({}))
    const elapsed = performance.now() - started
    return {
      ok: response.ok && result.ok !== false,
      status: response.status,
      elapsed,
      message: result.message ?? '',
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      elapsed: performance.now() - started,
      message: error.message,
    }
  }
}

async function runPool(startIndex, count) {
  return Promise.all(
    Array.from({ length: count }, (_, offset) => sendRequest(startIndex + offset)),
  )
}

async function main() {
  await verifyBoothExists()

  console.log(
    `Load test: ${totalRequests} requests, concurrency ${concurrency}, mode=${useRecordScan ? 'record-scan' : 'patch'}`,
  )
  console.log(`Target: ${baseUrl}`)

  const results = []
  for (let i = 0; i < totalRequests; i += concurrency) {
    const batch = await runPool(i, Math.min(concurrency, totalRequests - i))
    results.push(...batch)
    process.stdout.write(`\rCompleted ${results.length}/${totalRequests}`)
  }
  process.stdout.write('\n')

  const successes = results.filter((result) => result.ok)
  const failures = results.filter((result) => !result.ok)
  const latencies = results.map((result) => result.elapsed).sort((a, b) => a - b)
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0

  console.log(`Success: ${successes.length}/${results.length}`)
  console.log(`Failures: ${failures.length}`)
  console.log(`p95 latency: ${p95.toFixed(0)}ms`)

  if (failures.length) {
    const messages = [...new Set(failures.map((f) => f.message).filter(Boolean))]
    if (messages.length) {
      console.log('Error messages:', messages.slice(0, 5))
    }
    console.log('Sample failures:', failures.slice(0, 5))
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
