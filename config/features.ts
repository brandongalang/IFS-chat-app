import { env } from './env'

export type FeatureStatus = 'enabled' | 'coming_soon' | 'disabled'
export type FeatureKey =
  | 'chat'
  | 'insights'
  | 'garden'
  | 'journey'
  | 'settings'
  | 'profile'
  | 'home'
  | 'check-in'

const isTrue = (v?: string) => v === 'true' || v === '1' || v === 'on'

export function isDevMode(): boolean {
  return env.ifsDevMode
}

const devMode = isDevMode()
const gardenGridEnvOverride =
  process.env.NEXT_PUBLIC_IFS_GARDEN_GRID_VIEW ?? process.env.IFS_GARDEN_GRID_VIEW

const inboxFlag = process.env.NEXT_PUBLIC_IFS_INBOX ?? process.env.IFS_INBOX
const inboxActionsFlag =
  process.env.NEXT_PUBLIC_IFS_INBOX_ACTIONS ?? process.env.IFS_INBOX_ACTIONS

const gardenFlag = process.env.ENABLE_GARDEN ?? process.env.NEXT_PUBLIC_ENABLE_GARDEN
const gardenStatus: FeatureStatus =
  gardenFlag === undefined ? 'enabled' : isTrue(gardenFlag) ? 'enabled' : 'disabled'

const newUIFlag = process.env.NEXT_PUBLIC_IFS_NEW_UI ?? process.env.IFS_NEW_UI

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
  garden: gardenStatus,
  journey: 'coming_soon',
  settings: 'coming_soon',
  profile: 'enabled',
  'check-in': 'enabled',
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
    case 'check-in':
      return 'check-in'
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

export function isGardenGridViewEnabled(): boolean {
  if (devMode || (typeof window !== 'undefined' && clientDevOverride())) {
    return true
  }
  return isTrue(gardenGridEnvOverride)
}

export function isInboxEnabled(): boolean {
  if (devMode) return true
  if (typeof window !== 'undefined' && clientDevOverride()) return true
  return inboxFlag === undefined ? true : isTrue(inboxFlag)
}

export function isInboxActionsEnabled(): boolean {
  if (!isInboxEnabled()) return false
  if (devMode) return true
  if (typeof window !== 'undefined' && clientDevOverride()) return true
  return inboxActionsFlag === undefined ? true : isTrue(inboxActionsFlag)
}

// New UI redesign feature flag
// Headspace-inspired UI is now the default
export function isNewUIEnabled(): boolean {
  return true
}
