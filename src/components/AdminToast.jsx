import { useEffect } from 'react'

export function AdminToast({ message, onClear, duration = 3200 }) {
  useEffect(() => {
    if (!message) return undefined

    const timer = window.setTimeout(() => onClear(), duration)
    return () => window.clearTimeout(timer)
  }, [message, onClear, duration])

  if (!message) return null

  const tone = /saved/i.test(message) ? 'success' : 'error'

  return (
    <div className={`admin-toast ${tone}`} role="status" aria-live="polite">
      {message}
    </div>
  )
}
