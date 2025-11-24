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
import { isNewUIEnabled } from '@/config/features'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

const etherealTextStyle = {
  letterSpacing: 'var(--eth-letter-spacing-user)',
  color: 'rgba(255,255,255,var(--eth-user-opacity))',
} as const

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
  const newUI = isNewUIEnabled()

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
      router.push('/')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
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
      if (error) throw error
    } catch (err) {
      console.error('Google sign-in error:', err)
      setError(
        err instanceof Error
          ? `Google sign-in failed: ${err.message}`
          : 'Google sign-in failed. Please try again.'
      )
      setIsGoogleLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setError(null)
    setIsDemoLoading(true)
    try {
      const response = await fetch('/auth/demo-login', { method: 'POST' })
      const payload = (await response.json().catch(() => null)) as
        | { session?: { access_token: string; refresh_token: string }; error?: string }
        | null

      if (!response.ok) {
        throw new Error(
          payload?.error ?? 'Demo login failed. Please try again later.'
        )
      }

      if (!payload?.session) {
        throw new Error('Demo login did not return a session.')
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      })

      if (sessionError) throw sessionError
      router.push('/')
    } catch (err) {
      console.error('Demo login error', err)
      setError(err instanceof Error ? err.message : 'Demo login failed.')
    } finally {
      setIsDemoLoading(false)
    }
  }

  if (newUI) {
    return (
      <div className={cn('flex flex-col gap-6 hs-animate-in', className)} {...props}>
        {/* Logo/Brand */}
        <div className="text-center mb-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--hs-primary-muted)] flex items-center justify-center mb-4">
            <MaterialIcon name="spa" className="text-3xl text-[var(--hs-primary)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--hs-text-primary)]">Welcome back</h1>
          <p className="text-sm text-[var(--hs-text-secondary)] mt-1">
            Sign in to continue your journey
          </p>
        </div>

        {/* Form Card */}
        <div className="hs-card p-6">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-[var(--hs-text-secondary)]">
                Email
              </Label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="hs-input"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-[var(--hs-text-secondary)]">
                  Password
                </Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-[var(--hs-primary)] hover:text-[var(--hs-primary-dark)]"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="hs-input"
              />
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            <button
              type="submit"
              className="hs-btn-primary w-full mt-2"
              disabled={isLoading || isDemoLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--hs-border-subtle)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--hs-card)] px-2 text-[var(--hs-text-tertiary)]">
                Or continue with
              </span>
            </div>
          </div>

          {/* Social Login */}
          <button
            type="button"
            className="hs-btn-secondary w-full flex items-center justify-center gap-2"
            disabled={isGoogleLoading || isLoading}
            onClick={handleGoogleLogin}
          >
            {isGoogleLoading ? (
              <>
                <MaterialIcon name="progress_activity" className="text-base animate-spin" />
                Connecting...
              </>
            ) : (
              'Continue with Google'
            )}
          </button>

          {/* Demo Login */}
          {DEMO_AUTH_ENABLED && (
            <div className="mt-4 pt-4 border-t border-[var(--hs-border-subtle)]">
              <p className="text-xs text-center text-[var(--hs-text-tertiary)] mb-3">
                Preview the app
              </p>
              <button
                type="button"
                className="w-full py-2.5 px-4 rounded-full text-sm font-medium bg-[var(--hs-warm-muted)] text-[var(--hs-warm-dark)] hover:bg-[var(--hs-warm-light)]/30 transition-colors"
                disabled={isDemoLoading || isLoading || isGoogleLoading}
                onClick={handleDemoLogin}
              >
                {isDemoLoading ? 'Entering demo...' : 'Try the demo'}
              </button>
            </div>
          )}
        </div>

        {/* Sign up link */}
        <p className="text-center text-sm text-[var(--hs-text-secondary)]">
          Don&apos;t have an account?{' '}
          <Link
            href="/auth/sign-up"
            className="font-medium text-[var(--hs-primary)] hover:text-[var(--hs-primary-dark)]"
          >
            Sign up
          </Link>
        </p>
      </div>
    )
  }

  // Original UI
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card variant="ethereal">
        <CardHeader>
          <CardTitle className="text-2xl" style={etherealTextStyle}>
            Login
          </CardTitle>
          <CardDescription style={etherealTextStyle}>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            <form onSubmit={handleLogin} className="flex flex-col gap-6">
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
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading || isDemoLoading}>
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
              className="w-full"
              disabled={isGoogleLoading || isLoading}
              onClick={handleGoogleLogin}
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
              <Link href="/auth/sign-up" className="underline underline-offset-4">
                Sign up
              </Link>
            </div>
            {DEMO_AUTH_ENABLED ? (
              <div className="flex flex-col gap-2">
                <div className="text-center text-xs uppercase text-muted-foreground">
                  Preview the app
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={isDemoLoading || isLoading || isGoogleLoading}
                  onClick={handleDemoLogin}
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
