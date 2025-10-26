'use client'

import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const DEMO_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_IFS_DEMO_AUTH_ENABLED === 'true' ||
  process.env.NEXT_PUBLIC_IFS_DEMO_AUTH_ENABLED === '1' ||
  process.env.NEXT_PUBLIC_IFS_DEMO_AUTH_ENABLED === 'on'

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isDemoLoading, setIsDemoLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      // Redirect to home page on successful login
      router.push('/')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }



  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card className="rounded-3xl border-border/60 bg-card/95 shadow-xl shadow-primary/10 ring-1 ring-border/60">
        <CardHeader className="space-y-2 pb-0">
          <CardTitle className="text-2xl font-semibold text-foreground">
            Welcome back
          </CardTitle>
          <CardDescription>
            Enter your email to continue exploring your inner landscape.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col gap-6">
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full rounded-full" disabled={isLoading || isDemoLoading}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full border-border/50"
              disabled={isGoogleLoading || isLoading}
              onClick={async () => {
                setIsGoogleLoading(true)
                setError(null)
                
                try {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: `${window.location.origin}/auth/callback`,
                      queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                      },
                    },
                  })
                  if (error) {
                    console.error('Google OAuth error:', error)
                    throw error
                  }
                  // The redirect will happen automatically, so we don't need to do anything else
                } catch (err) {
                  console.error('Google sign-in error:', err)
                  setError(
                    err instanceof Error 
                      ? `Google sign-in failed: ${err.message}` 
                      : 'Google sign-in failed. Please try again.'
                  )
                  setIsGoogleLoading(false)
                }
              }}
              aria-label="Sign in with Google"
            >
              {isGoogleLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                  Connecting to Google...
                </>
              ) : (
                'Continue with Google'
              )}
            </Button>
            <div className="text-center text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/auth/sign-up" className="font-semibold text-primary underline-offset-4 hover:underline">
                Sign up
              </Link>
            </div>
            {DEMO_AUTH_ENABLED ? (
              <div className="flex flex-col gap-2">
                <div className="text-center text-xs uppercase text-muted-foreground">Preview the app</div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full rounded-full"
                  disabled={isDemoLoading || isLoading || isGoogleLoading}
                  onClick={async () => {
                    setError(null)
                    setIsDemoLoading(true)
                    try {
                      const response = await fetch('/auth/demo-login', {
                        method: 'POST',
                      })
                      const payload = (await response.json().catch(() => null)) as
                        | {
                            session?: {
                              access_token: string
                              refresh_token: string
                            }
                            error?: string
                          }
                        | null

                      if (!response.ok) {
                        const message = payload && typeof payload.error === 'string'
                          ? payload.error
                          : 'Demo login failed. Please try again later.'
                        throw new Error(message)
                      }

                      if (!payload?.session) {
                        throw new Error('Demo login did not return a session.')
                      }

                      const { error: sessionError } = await supabase.auth.setSession({
                        access_token: payload.session.access_token,
                        refresh_token: payload.session.refresh_token,
                      })

                      if (sessionError) {
                        throw sessionError
                      }

                      router.push('/')
                    } catch (err) {
                      console.error('Demo login error', err)
                      setError(
                        err instanceof Error
                          ? err.message
                          : 'Demo login failed. Please try again later.'
                      )
                    } finally {
                      setIsDemoLoading(false)
                    }
                  }}
                >
                  {isDemoLoading ? 'Entering demo...' : 'Try the demo'}
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
