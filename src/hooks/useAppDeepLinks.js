import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useEffect } from 'react'
import { applyAdminDeepLink } from '../services/adminDeepLink'

export function useAppDeepLinks({ onAdminRoute } = {}) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined

    const handleUrl = (url) => {
      if (applyAdminDeepLink(url)) {
        onAdminRoute?.()
      }
    }

    let listenerHandle

    App.getLaunchUrl()
      .then((result) => {
        if (result?.url) handleUrl(result.url)
      })
      .catch(() => {})

    App.addListener('appUrlOpen', (event) => {
      handleUrl(event.url)
    })
      .then((handle) => {
        listenerHandle = handle
      })
      .catch(() => {})

    return () => {
      listenerHandle?.remove()
    }
  }, [onAdminRoute])
}
