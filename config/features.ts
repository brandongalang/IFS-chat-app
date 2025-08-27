export type FeatureStatus = 'enabled' | 'coming_soon' | 'disabled'
export type FeatureKey =
  | 'chat'
  | 'insights'
  | 'garden'
  | 'journey'
  | 'settings'
  | 'profile'
  | 'home'

export const devMode = process.env.NEXT_PUBLIC_IFS_DEV_MODE === 'true'

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
  const effective: FeatureStatus = devMode && status !== 'disabled' ? 'enabled' : status
  return { key, status: effective }
}

