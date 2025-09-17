'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            nonce?: string;
          }) => void;
          prompt: (
            cb: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void
          ) => void;
          renderButton: (
            container: HTMLElement | null,
            options: {
              theme: 'outline' | 'filled_blue' | 'filled_black' | 'standard' | 'icon' | 'text';
              size: 'large' | 'medium' | 'small';
              width?: string;
              text?: string;
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
            }
          ) => void;
        };
      };
    };
  }
}

type GoogleIdentity = NonNullable<Window['google']>

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null

const DEBUG_PREFIX = '[useGoogleAuth]'
const shouldLogDebug = process.env.NODE_ENV !== 'production'

function debugLog(...args: unknown[]) {
  if (!shouldLogDebug) return
  console.info(DEBUG_PREFIX, ...args)
}

function debugWarn(...args: unknown[]) {
  if (!shouldLogDebug) return
  console.warn(DEBUG_PREFIX, ...args)
}

function redact(value: string | undefined | null, options: { prefix?: number; suffix?: number } = {}) {
  if (!value) return 'unset'
  const prefixLength = options.prefix ?? 4
  const suffixLength = options.suffix ?? 4
  if (value.length <= prefixLength + suffixLength + 3) {
    return `${value} (len ${value.length})`
  }
  const start = value.slice(0, prefixLength)
  const end = value.slice(-suffixLength)
  return `${start}…${end} (len ${value.length})`
}

function formatNonce(nonce: string | null | undefined) {
  if (!nonce) return 'none'
  return redact(nonce, { prefix: 6, suffix: 4 })
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateNonce() {
  if (typeof window === 'undefined') {
    throw new Error('Window object not available')
  }
  const cryptoObj = window.crypto
  if (!cryptoObj?.getRandomValues) {
    throw new Error('Secure random generator unavailable')
  }
  const randomBytes = new Uint8Array(32)
  cryptoObj.getRandomValues(randomBytes)
  return toBase64Url(randomBytes)
}

async function hashNonce(raw: string) {
  if (typeof window === 'undefined') {
    throw new Error('Window object not available')
  }
  const cryptoObj = window.crypto
  if (!cryptoObj?.subtle || !textEncoder) {
    throw new Error('Secure hashing unavailable')
  }
  const digest = await cryptoObj.subtle.digest('SHA-256', textEncoder.encode(raw))
  return toBase64Url(new Uint8Array(digest))
}

type NonceState = {
  raw: string
  hashed: string
}

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const nonceRef = useRef<NonceState | null>(null)
  const redirectPathRef = useRef('/')
  const envReportedRef = useRef(false)

  if (shouldLogDebug && !envReportedRef.current) {
    envReportedRef.current = true
    debugLog('Environment diagnostics', {
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: redact(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
      NEXT_PUBLIC_SUPABASE_URL: redact(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, {
        prefix: 12,
        suffix: 0,
      }),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: redact(
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
        { prefix: 6, suffix: 4 }
      ),
    })
  }

  const initializeGoogleSignIn = () => {
    return new Promise<GoogleIdentity>((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window object not available'))
        return
      }

      // Load Google Identity Services script if not already loaded
      if (!window.google) {
        const script = document.createElement('script')
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        script.onload = () => {
          if (window.google) {
            resolve(window.google)
          } else {
            reject(new Error('Google Identity failed to initialize'))
          }
        }
        script.onerror = () => {
          reject(new Error('Failed to load Google Identity Services'))
        }
        document.head.appendChild(script)
      } else {
        resolve(window.google)
      }
    })
  }

  const ensureNonce = async () => {
    if (nonceRef.current) {
      debugLog('Reusing cached nonce', {
        raw: formatNonce(nonceRef.current.raw),
        hashed: formatNonce(nonceRef.current.hashed),
      })
      return nonceRef.current
    }
    const nonce = generateNonce()
    const hashed = await hashNonce(nonce)
    const state: NonceState = { raw: nonce, hashed }
    nonceRef.current = state
    debugLog('Generated new nonce', {
      raw: formatNonce(state.raw),
      hashed: formatNonce(state.hashed),
    })
    return state
  }

  const configureGoogleClient = async (redirectPath: string) => {
    const google = await initializeGoogleSignIn()

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) throw new Error('Google Client ID not configured')

    const nonceState = await ensureNonce()
    redirectPathRef.current = redirectPath
    debugLog('Configuring Google Identity client', {
      redirectPath,
      clientId: redact(clientId, { prefix: 8, suffix: 4 }),
      nonceRaw: formatNonce(nonceState.raw),
      nonceHashed: formatNonce(nonceState.hashed),
    })

    google.accounts.id.initialize({
      client_id: clientId,
      nonce: nonceState.raw,
      callback: async (response: { credential: string }) => {
        try {
          setIsLoading(true)
          setError(null)

          const activeNonce = nonceRef.current ?? nonceState
          if (!activeNonce) {
            throw new Error('Missing nonce for Google sign-in')
          }

          const idTokenPayload = decodeIdToken(response.credential)
          let computedHash: string | null = null
          try {
            computedHash = await hashNonce(activeNonce.raw)
          } catch (hashError) {
            debugWarn('Failed to hash nonce for comparison', hashError)
          }

          debugLog('Nonce comparison before Supabase sign-in', {
            raw: formatNonce(activeNonce.raw),
            cachedHashed: formatNonce(activeNonce.hashed),
            recomputedHashed: computedHash ? formatNonce(computedHash) : 'none',
            tokenNonce: idTokenPayload?.nonce ? formatNonce(idTokenPayload.nonce) : 'none',
            tokenAud: idTokenPayload?.aud ? redact(idTokenPayload.aud) : 'unset',
            tokenIss: idTokenPayload?.iss ?? 'unset',
          })

          debugLog('Attempting Supabase sign-in with ID token', {
            redirectPath: redirectPathRef.current,
            nonceRaw: formatNonce(activeNonce.raw),
          })

          const { error: authError } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
            nonce: activeNonce.raw,
          })
          if (authError) throw authError

          debugLog('Supabase sign-in succeeded')
          nonceRef.current = null
          await redirectAfterSignIn(redirectPathRef.current)
        } catch (authError) {
          nonceRef.current = null
          const message = authError instanceof Error ? authError.message : 'Authentication failed'
          debugWarn('Supabase sign-in failed', {
            message,
            details: authError,
          })
          setError(message)
          setIsLoading(false)
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    })

    return google
  }

  const redirectAfterSignIn = async (fallbackPath: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace(fallbackPath)
        return
      }

      // Check onboarding status; create initial state if missing
      let needsOnboarding = true
      const { data: onboarding, error: fetchErr } = await supabase
        .from('user_onboarding')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!fetchErr && onboarding) {
        needsOnboarding = onboarding.status !== 'completed'
      } else if (fetchErr) {
        // If fetch failed for some reason, fall back to treating as needs onboarding
        needsOnboarding = true
      } else if (!onboarding) {
        // Create initial state if none exists
        const { error: createErr } = await supabase
          .from('user_onboarding')
          .insert({ user_id: user.id, stage: 'stage1', status: 'in_progress' })
        if (createErr) {
          // Non-fatal; still treat as needs onboarding
          // console.warn('Failed to create onboarding state', createErr)
        }
        needsOnboarding = true
      }

      // Hint middleware/UX with a lightweight cookie (not security-critical)
      try {
        document.cookie = `ifs_onb=${needsOnboarding ? '1' : '0'}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
      } catch {}

      router.replace(needsOnboarding ? '/onboarding' : fallbackPath)
    } catch {
      router.replace(fallbackPath)
    }
  }

  // Initialize and render the standard Google button into a container
  const initGoogleButton = async (containerId: string = 'google-btn-container', redirectPath = '/') => {
    setError(null)
    try {
      const google = await configureGoogleClient(redirectPath)
      const container = document.getElementById(containerId)
      if (container) {
        container.innerHTML = ''
        google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        })
      }
    } catch (authError) {
      debugWarn('Failed to initialize Google button', authError)
      setError(authError instanceof Error ? authError.message : 'Failed to initialize Google Sign-In')
    }
  }

  const signInWithGoogle = async (redirectPath = '/', containerId = 'google-btn-container') => {
    setIsLoading(true)
    setError(null)

    try {
      const google = await configureGoogleClient(redirectPath)

      google.accounts.id.prompt((notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback to popup if prompt is not displayed
          google.accounts.id.renderButton(
            document.getElementById(containerId),
            {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'signin_with',
              shape: 'rectangular',
              logo_alignment: 'left',
            }
          )
          setIsLoading(false)
          debugWarn('Google prompt not displayed; rendered fallback button')
        }
      })
    } catch (authError) {
      debugWarn('Google prompt initialization failed', authError)
      setError(authError instanceof Error ? authError.message : 'Failed to initialize Google Sign-In')
      setIsLoading(false)
    }
  }

  return {
    initGoogleButton,
    signInWithGoogle,
    isLoading,
    error,
  }
}

function decodeIdToken(token: string): { [key: string]: any } | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64 = parts[1]
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const normalized = padded.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = typeof window !== 'undefined' ? window.atob(normalized) : atob(normalized)
    return JSON.parse(decoded)
  } catch {
    return null
  }
}
