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

const textEncoder = new TextEncoder()

type GoogleIdentity = NonNullable<Window['google']>

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function generateNoncePair() {
  if (typeof window === 'undefined') {
    throw new Error('Window object not available')
  }
  const cryptoObj = window.crypto
  if (!cryptoObj?.getRandomValues || !cryptoObj?.subtle) {
    throw new Error('Secure random generator unavailable')
  }
  const randomBytes = new Uint8Array(32)
  cryptoObj.getRandomValues(randomBytes)
  const raw = toBase64Url(randomBytes)
  const digest = await cryptoObj.subtle.digest('SHA-256', textEncoder.encode(raw))
  const hashed = toBase64Url(new Uint8Array(digest))
  return { raw, hashed }
}

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const nonceRef = useRef<{ raw: string; hashed: string } | null>(null)
  const redirectPathRef = useRef('/')

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

  const ensureNoncePair = async () => {
    if (nonceRef.current) {
      return nonceRef.current
    }
    if (typeof window === 'undefined') {
      throw new Error('Window object not available')
    }
    const pair = await generateNoncePair()
    nonceRef.current = pair
    return pair
  }

  const configureGoogleClient = async (redirectPath: string) => {
    const google = await initializeGoogleSignIn()

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) throw new Error('Google Client ID not configured')

    const pair = await ensureNoncePair()
    redirectPathRef.current = redirectPath

    google.accounts.id.initialize({
      client_id: clientId,
      nonce: pair.hashed,
      callback: async (response: { credential: string }) => {
        try {
          setIsLoading(true)
          setError(null)

          const activeNonce = nonceRef.current?.raw ?? pair.raw
          if (!activeNonce) {
            throw new Error('Missing nonce for Google sign-in')
          }

          const { error: authError } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
            nonce: activeNonce,
          })
          if (authError) throw authError

          nonceRef.current = null
          await redirectAfterSignIn(redirectPathRef.current)
        } catch (authError) {
          nonceRef.current = null
          setError(authError instanceof Error ? authError.message : 'Authentication failed')
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
      setError(authError instanceof Error ? authError.message : 'Failed to initialize Google Sign-In')
    }
  }

  const signInWithGoogle = async (redirectPath = '/') => {
    setIsLoading(true)
    setError(null)

    try {
      const google = await configureGoogleClient(redirectPath)

      // Prompt the user to sign in
      google.accounts.id.prompt((notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback to popup if prompt is not displayed
          google.accounts.id.renderButton(
            document.getElementById('google-btn-container'),
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
        }
      })
    } catch (authError) {
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
