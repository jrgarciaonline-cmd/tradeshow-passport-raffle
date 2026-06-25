const ALLOWED_ORIGIN_SUFFIXES = ['.vercel.app']

const ALLOWED_ORIGINS = new Set([
  'http://localhost:4173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
  'https://tradeshow-passport-raffle.vercel.app',
])

function isAllowedOrigin(origin) {
  if (!origin) return false
  if (ALLOWED_ORIGINS.has(origin)) return true
  return ALLOWED_ORIGIN_SUFFIXES.some((suffix) => origin.endsWith(suffix))
}

export function setCorsHeaders(request, response) {
  const origin = request.headers.origin

  if (isAllowedOrigin(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
  }

  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export function handleCors(request, response) {
  setCorsHeaders(request, response)

  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return true
  }

  return false
}
