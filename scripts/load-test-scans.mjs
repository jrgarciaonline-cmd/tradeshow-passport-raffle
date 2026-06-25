#!/usr/bin/env node
/**
 * Load test for scan recording via the write proxy.
 *
 * Usage:
 *   node scripts/load-test-scans.mjs --url=https://your-app.vercel.app --event-id=... --requests=200
 *
 * Requires a valid signed scan token (or legacy patch mode when signing is off).
 * For signed mode, generate tokens with SCAN_SIGNING_SECRET set locally.
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
const boothId = getArg('booth-id', 'test-booth')
const totalRequests = Math.max(1, Number(getArg('requests', '200')) || 200)
const concurrency = Math.max(1, Number(getArg('concurrency', '20')) || 20)
const useRecordScan = getArg('mode', 'patch') === 'record-scan'

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
            email: `loadtest-${index}@example.com`,
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
    const elapsed = performance.now() - started
    return { ok: response.ok, status: response.status, elapsed }
  } catch (error) {
    return { ok: false, status: 0, elapsed: performance.now() - started, error: error.message }
  }
}

async function runPool(startIndex, count) {
  return Promise.all(
    Array.from({ length: count }, (_, offset) => sendRequest(startIndex + offset)),
  )
}

async function main() {
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
    const sample = failures.slice(0, 5)
    console.log('Sample failures:', sample)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
