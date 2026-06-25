import { createServer } from 'node:http'
import { loadEnvFile } from './load-env.mjs'

loadEnvFile()

const PORT = Number(process.env.LOCAL_API_PORT || 3001)

const routes = {
  'POST /api/admin-login': () => import('../api/admin-login.js'),
  'POST /api/request-admin-password-reset': () =>
    import('../api/request-admin-password-reset.js'),
  'POST /api/reset-admin-password': () => import('../api/reset-admin-password.js'),
  'POST /api/invite-admin': () => import('../api/invite-admin.js'),
  'POST /api/badge-lookup': () => import('../api/badge-lookup.js'),
  'POST /api/passport-write': () => import('../api/passport-write.js'),
  'POST /api/record-scan': () => import('../api/record-scan.js'),
  'POST /api/sign-scan-token': () => import('../api/sign-scan-token.js'),
  'POST /api/gdpr-request': () => import('../api/gdpr-request.js'),
}

async function readJsonBody(request) {
  const chunks = []
  const maxBytes = 10 * 1024
  let totalBytes = 0

  for await (const chunk of request) {
    totalBytes += chunk.length
    if (totalBytes > maxBytes) {
      throw new Error('Request body too large.')
    }
    chunks.push(chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim()) return {}

  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function createResponseAdapter(rawResponse) {
  let statusCode = 200
  const headers = {}

  return {
    status(code) {
      statusCode = code
      return this
    },
    setHeader(name, value) {
      headers[name.toLowerCase()] = value
      return this
    },
    json(body) {
      const payload = JSON.stringify(body)
      headers['content-type'] = 'application/json; charset=utf-8'
      headers['content-length'] = String(Buffer.byteLength(payload))
      rawResponse.writeHead(statusCode, headers)
      rawResponse.end(payload)
    },
    end(body = '') {
      rawResponse.writeHead(statusCode, headers)
      rawResponse.end(body)
    },
  }
}

function createRequestAdapter(rawRequest, body, url) {
  const headerEntries = Object.entries(rawRequest.headers).map(([key, value]) => [
    key,
    Array.isArray(value) ? value.join(', ') : value,
  ])

  return {
    method: rawRequest.method,
    url,
    headers: Object.fromEntries(headerEntries),
    body,
  }
}

const server = createServer(async (rawRequest, rawResponse) => {
  const url = new URL(rawRequest.url || '/', `http://${rawRequest.headers.host || 'localhost'}`)
  const routeKey = `${rawRequest.method} ${url.pathname}`
  const loadHandler = routes[routeKey]

  if (!loadHandler) {
    rawResponse.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    rawResponse.end(JSON.stringify({ ok: false, message: 'API route not found.' }))
    return
  }

  try {
    const body = await readJsonBody(rawRequest)
    const request = createRequestAdapter(rawRequest, body, url.pathname)
    const response = createResponseAdapter(rawResponse)
    const module = await loadHandler()
    await module.default(request, response)
  } catch (error) {
    console.error(error)
    if (!rawResponse.headersSent) {
      rawResponse.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      rawResponse.end(JSON.stringify({ ok: false, message: 'Local API server error.' }))
    }
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Local admin API listening on http://127.0.0.1:${PORT}`)
})
