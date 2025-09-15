'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface UserProfile {
  id: string
  name: string
  bio: string
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
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase
          .from('users')
          .select('name, bio')
          .eq('id', user.id)
          .single()

        setProfile({
          id: user.id,
          name: data?.name || '',
          bio: data?.bio || '',
        })
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
