const PROTOCOL_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//

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
  const targetEnv = process.env.TARGET_ENV
  
  // Use production credentials when TARGET_ENV=prod
  if (targetEnv === 'prod') {
    return normalizeUrl(process.env.PROD_PUBLIC_SUPABASE_URL)
  }
  
  // Default: use standard env vars (local or standard deployment)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  return normalizeUrl(url)
}

export function getSupabaseKey(): string | undefined {
  const targetEnv = process.env.TARGET_ENV
  
  // Use production credentials when TARGET_ENV=prod
  if (targetEnv === 'prod') {
    return normalizeKey(process.env.PROD_SUPABASE_ANON_KEY)
  }
  
  // Default: use standard env vars (local or standard deployment)
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  return normalizeKey(key)
}

export function getSupabaseServiceRoleKey(): string | undefined {
  const targetEnv = process.env.TARGET_ENV
  
  // Use production credentials when TARGET_ENV=prod
  if (targetEnv === 'prod') {
    return normalizeKey(process.env.PROD_SUPABASE_SERVICE_ROLE_KEY)
  }
  
  // Default: use standard env vars (local or standard deployment)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return normalizeKey(key)
}
