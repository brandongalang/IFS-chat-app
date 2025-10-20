import { env } from './env'

type DemoAuthCredentials = {
  email: string
  password: string
}

export function isDemoAuthEnabled(): boolean {
  return env.ifsDemoAuthEnabled && Boolean(env.ifsDemoAuthEmail) && Boolean(env.ifsDemoAuthPassword)
}

export function isDemoAuthClientEnabled(): boolean {
  return env.nextPublicIfsDemoAuthEnabled
}

export function getDemoAuthCredentials(): DemoAuthCredentials | null {
  const email = env.ifsDemoAuthEmail
  const password = env.ifsDemoAuthPassword

  if (!email || !password) {
    return null
  }

  return { email, password }
}

export function requireDemoAuthCredentials(): DemoAuthCredentials {
  const credentials = getDemoAuthCredentials()
  if (!credentials) {
    throw new Error('Demo auth credentials are not configured. Set IFS_DEMO_AUTH_EMAIL and IFS_DEMO_AUTH_PASSWORD.')
  }
  return credentials
}

export function getDemoAuthConfig():
  | {
      enabled: boolean
      credentials: DemoAuthCredentials | null
    }
  | null {
  if (!env.ifsDemoAuthEnabled) {
    return null
  }

  return {
    enabled: true,
    credentials: getDemoAuthCredentials(),
  }
}
