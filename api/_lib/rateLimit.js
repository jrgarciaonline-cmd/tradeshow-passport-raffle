const buckets = new Map()

export function getClientIp(request) {
  const forwarded = request.headers['x-forwarded-for']

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }

  return request.headers['x-real-ip'] || 'unknown'
}

export function rateLimit({ key, limit, windowMs }) {
  const now = Date.now()
  const record = buckets.get(key)

  if (!record || now >= record.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 }
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: record.resetAt - now }
  }

  record.count += 1
  return { allowed: true, remaining: limit - record.count, retryAfterMs: 0 }
}

export function enforceRateLimit(response, options) {
  const result = rateLimit(options)

  if (!result.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000))
    response.setHeader('Retry-After', String(retryAfterSeconds))
    response.status(429).json({
      ok: false,
      message: `Too many attempts. Try again in ${retryAfterSeconds} seconds.`,
    })
    return false
  }

  return true
}

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()

    for (const [key, record] of buckets) {
      if (now >= record.resetAt) {
        buckets.delete(key)
      }
    }
  }, 60_000)
}
