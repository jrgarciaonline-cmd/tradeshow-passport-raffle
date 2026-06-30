export function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function phonesMatch(left, right) {
  const normalizedLeft = normalizePhone(left)
  const normalizedRight = normalizePhone(right)
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
}
