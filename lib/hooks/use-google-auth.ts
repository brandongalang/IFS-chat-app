'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
            options: { theme: 'outline' | 'filled_blue' | 'filled_black' | 'standard' | 'icon' | 'text'; size: 'large' | 'medium' | 'small'; width?: string }
          ) => void;
        };
      };
    };
  }
}

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const initializeGoogleSignIn = () => {
    return new Promise((resolve, reject) => {
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
          resolve(window.google)
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

  const signInWithGoogle = async (redirectPath = '/') => {
    setIsLoading(true)
    setError(null)

    try {
      await initializeGoogleSignIn()

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      if (!clientId) {
        throw new Error('Google Client ID not configured')
      }

      // Initialize Google Identity Services
      if (!window.google) {
        throw new Error('Google Identity not initialized')
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          try {
            const { credential } = response
            
            // Use Supabase's signInWithIdToken method
            const { error } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: credential,
            })

            if (error) {
              throw error
            }

            // Successful authentication: immediately decide where to go
            await redirectAfterSignIn(redirectPath)
          } catch (authError) {
            setError(authError instanceof Error ? authError.message : 'Authentication failed')
            setIsLoading(false)
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      })

      // Prompt the user to sign in
      if (!window.google) {
        throw new Error('Google Identity not initialized')
      }
      window.google.accounts.id.prompt((notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback to popup if prompt is not displayed
          window.google!.accounts.id.renderButton(
            document.getElementById('google-signin-button'),
            {
              theme: 'outline',
              size: 'large',
              width: '100%',
            }
          )
        }
      })
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Failed to initialize Google Sign-In')
      setIsLoading(false)
    }
  }

  return {
    signInWithGoogle,
    isLoading,
    error,
  }
}
