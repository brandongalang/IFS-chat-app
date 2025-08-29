export type FeatureStatus = 'enabled' | 'coming_soon' | 'disabled'
export type FeatureKey =
  | 'chat'
  | 'insights'
  | 'garden'
  | 'journey'
  | 'settings'
  | 'profile'
  | 'home'

const isTrue = (v?: string) => v === 'true' || v === '1' || v === 'on'

export const devMode =
  isTrue(process.env.NEXT_PUBLIC_IFS_DEV_MODE) ||
  process.env.NODE_ENV === 'development'

// Whether to show the "Enable Dev Mode" toggle in the UI.
// Default behavior: show in development, hide in production unless explicitly enabled.
export const showDevToggle =
  process.env.NEXT_PUBLIC_IFS_SHOW_DEV_TOGGLE === undefined
    ? process.env.NODE_ENV === 'development'
    : isTrue(process.env.NEXT_PUBLIC_IFS_SHOW_DEV_TOGGLE)

// Optional client-only override using localStorage set by the UI toggle.
export function clientDevOverride(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = window.localStorage.getItem('IFS_DEV_MODE') || undefined
    return isTrue(v)
  } catch {
    return false
  }
}

export const features: Record<FeatureKey, FeatureStatus> = {
  chat: 'enabled',
  home: 'enabled',
  insights: 'coming_soon',
  garden: 'coming_soon',
  journey: 'coming_soon',
  settings: 'coming_soon',
  profile: 'enabled',
}

export function featureKeyForPathname(pathname: string): FeatureKey {
  const path = (pathname || '/').split('?')[0].split('#')[0]
  const seg = (path.startsWith('/') ? path.slice(1) : path).split('/')[0] || ''
  switch (seg) {
    case '':
      return 'home'
    case 'chat':
      return 'chat'
    case 'insights':
      return 'insights'
    case 'garden':
      return 'garden'
    case 'journey':
      return 'journey'
    case 'settings':
      return 'settings'
    case 'profile':
      return 'profile'
    default:
      return 'home'
  }
}

export function statusForPath(pathname: string): { key: FeatureKey; status: FeatureStatus } {
  const key = featureKeyForPathname(pathname)
  const status = features[key]
  const enabled = devMode || (typeof window !== 'undefined' && clientDevOverride())
  const effective: FeatureStatus = enabled && status !== 'disabled' ? 'enabled' : status
  return { key, status: effective }
}
