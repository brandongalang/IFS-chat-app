'use client'

import { useEffect } from 'react'
import { defaultEtherealTheme as T } from '@/config/etherealTheme'

export function ThemeController() {
  useEffect(() => {
    const r = document.documentElement
    const apply = () => {
      r.style.setProperty('--eth-enabled', String(T.enabled))
      r.style.setProperty('--eth-image-url', T.imageUrl)
      r.style.setProperty('--eth-vignette-inner', String(T.vignette.inner))
      r.style.setProperty('--eth-vignette-mid', String(T.vignette.mid))
      r.style.setProperty('--eth-vignette-outer', String(T.vignette.outer))
      r.style.setProperty('--eth-assistant-opacity', String(T.text.assistantOpacity))
      r.style.setProperty('--eth-user-opacity', String(T.text.userOpacity))
      r.style.setProperty('--eth-letter-spacing-assistant', T.text.letterSpacingAssistant)
      r.style.setProperty('--eth-letter-spacing-user', T.text.letterSpacingUser)
      r.style.setProperty('--eth-word-duration', `${T.animation.wordDurationMs}`)
      r.style.setProperty('--eth-char-duration', `${T.animation.charDurationMs}`)
      r.style.setProperty('--eth-stream-tick', `${T.animation.streamTickMs}`)
      r.style.setProperty('--eth-stream-chars', `${T.animation.streamCharsPerTick}`)
      try {
        r.style.setProperty('--eth-blobs', JSON.stringify(T.blobs))
      } catch {}
    }
    // Allow a dev override from localStorage
    try {
      const raw = localStorage.getItem('eth-theme')
      if (raw) {
        const o = JSON.parse(raw)
        Object.entries(o || {}).forEach(([k, v]) => {
          if (typeof v === 'object') return
          r.style.setProperty(`--eth-${k}`, String(v))
        })
      }
    } catch {}
    apply()
  }, [])
  return null
}
