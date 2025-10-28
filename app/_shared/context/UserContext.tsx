'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { dev } from '@/config/dev'
import { resolveUserId } from '@/config/dev'
import { getCurrentPersona, TEST_PERSONAS } from '@/config/personas'

export interface UserProfile {
  id: string
  name: string
  bio: string
  avatarUrl: string | null
}

export interface UserContextValue {
  profile: UserProfile | null
  loading: boolean
}

const UserContext = createContext<UserContextValue | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)

      // DEV MODE: Inject mock profile based on persona
      if (dev.enabled) {
        try {
          const userId = resolveUserId()
          const persona = getCurrentPersona()
          const personaConfig = TEST_PERSONAS[persona]

          setProfile({
            id: userId,
            name: personaConfig.name,
            bio: personaConfig.description || '',
            avatarUrl: null,
          })
        } catch (error) {
          console.error('Failed to create dev mode profile', error)
          setProfile(null)
        }
        setLoading(false)
        return
      }

      // PRODUCTION: Use Supabase auth
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('name, avatar_url')
            .eq('id', user.id)
            .maybeSingle()

          if (error) {
            console.error('Failed to load user profile', error)
          }

          const bio =
            typeof (user as { user_metadata?: Record<string, unknown> }).user_metadata?.bio === 'string'
              ? ((user as { user_metadata?: { bio?: string } }).user_metadata?.bio as string)
              : ''

          setProfile({
            id: user.id,
            name: data?.name || '',
            bio,
            avatarUrl: data?.avatar_url?.trim() || null,
          })
        } catch (error) {
          console.error('Unexpected error fetching user profile', error)
          setProfile({
            id: user.id,
            name: '',
            bio: '',
            avatarUrl: null,
          })
        }
      } else {
        setProfile(null)
      }

      setLoading(false)
    }

    fetchProfile()
  }, [supabase])

  return (
    <UserContext.Provider value={{ profile, loading }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): UserContextValue {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
