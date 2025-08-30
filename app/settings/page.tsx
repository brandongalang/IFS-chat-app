'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isPortalLoading, setIsPortalLoading] = useState(false)
  const [isLogoutLoading, setIsLogoutLoading] = useState(false)

  const redirectToCustomerPortal = async () => {
    setIsPortalLoading(true)
    try {
      const response = await fetch('/api/stripe/create-portal-link', {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to create portal link.')
      }
      const { url } = await response.json()
      router.push(url)
    } catch (error) {
      console.error(error)
      // TODO: show toast notification
    } finally {
      setIsPortalLoading(false)
    }
  }

  const handleLogout = async () => {
    setIsLogoutLoading(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
    setIsLogoutLoading(false)
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account and subscription.</p>
      </header>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              Manage your billing information and view your subscription details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={redirectToCustomerPortal} disabled={isPortalLoading}>
              {isPortalLoading ? 'Loading...' : 'Manage Subscription'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Log out of your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleLogout} disabled={isLogoutLoading}>
              {isLogoutLoading ? 'Logging out...' : 'Log Out'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
