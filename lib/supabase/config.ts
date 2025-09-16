const URL_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_URL',
] as const

const ANON_KEY_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_ANON_KEY',
] as const

const SERVICE_ROLE_KEY_ENV_KEYS = ['SUPABASE_SERVICE_ROLE_KEY'] as const

const PROTOCOL_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//

function readEnv(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return undefined
}

function normalizeUrl(raw?: string): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  const hasProtocol = PROTOCOL_REGEX.test(trimmed)
  const value = hasProtocol ? trimmed : buildUrlWithDefaultProtocol(trimmed)

  try {
    const parsed = new URL(value)
    return parsed.origin
  } catch {
    return undefined
  }
}

function buildUrlWithDefaultProtocol(value: string): string {
  const host = value.split('/')[0]
  const hostWithoutPort = host.split(':')[0]
  const isLocalhost =
    /^localhost$/i.test(hostWithoutPort) ||
    hostWithoutPort === '0.0.0.0' ||
    /^127(?:\.\d{1,3}){3}$/.test(hostWithoutPort)
  const defaultProtocol = isLocalhost ? 'http://' : 'https://'
  return `${defaultProtocol}${value}`
}

function normalizeKey(raw?: string): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function getSupabaseUrl(): string | undefined {
  return normalizeUrl(readEnv(URL_ENV_KEYS))
}

export function getSupabaseKey(): string | undefined {
  return normalizeKey(readEnv(ANON_KEY_ENV_KEYS))
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return normalizeKey(readEnv(SERVICE_ROLE_KEY_ENV_KEYS))
}
