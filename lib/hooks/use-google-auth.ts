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

            // Successful authentication, redirect
            router.push(redirectPath)
          } catch (authError) {
            setError(authError instanceof Error ? authError.message : 'Authentication failed')
          } finally {
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