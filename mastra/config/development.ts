/**
 * Development configuration for IFS Therapy tools
 * 
 * This configuration allows for testing tools without full authentication
 * by providing default values for required parameters like userId.
 */

export type TestPersona = 'beginner' | 'moderate' | 'advanced'

export interface TestPersonaConfig {
  id: string
  name: string
  email: string
  description: string
}

export interface DevelopmentConfig {
  /** Enable development mode features */
  enabled: boolean
  /** Default user ID to use when none is provided (for testing) */
  defaultUserId: string | null
  /** Log all tool executions for debugging */
  verbose: boolean
  /** In dev, skip updating polarization_level to avoid tsx runtime quirk */
  disablePolarizationUpdate: boolean
  /** Test personas for synthetic user testing */
  testPersonas: Record<TestPersona, TestPersonaConfig>
  /** Current test persona selection */
  currentPersona: TestPersona
}

// Test persona configurations
export const TEST_PERSONAS: Record<TestPersona, TestPersonaConfig> = {
  beginner: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Alex Beginner',
    email: 'alex.beginner@ifsdev.local',
    description: 'New to IFS (14 days), 3-5 sessions, discovering first parts'
  },
  moderate: {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Jamie Moderate',
    email: 'jamie.moderate@ifsdev.local',
    description: 'Regular user (90 days), 10-14 sessions, active part relationships'
  },
  advanced: {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Riley Advanced',
    email: 'riley.advanced@ifsdev.local',
    description: 'Power user (180+ days), 20+ sessions, complex part ecosystem'
  }
}

// Default development configuration
export const developmentConfig: DevelopmentConfig = {
  enabled: (() => {
    const val =
      process.env.IFS_DEV_MODE ||
      (process as any).env?.PUBLIC_IFS_DEV_MODE ||
      (process as any).env?.NEXT_PUBLIC_IFS_DEV_MODE ||
      (process as any).env?.VITE_IFS_DEV_MODE
    return process.env.NODE_ENV !== 'production' && val === 'true'
  })(),
  defaultUserId:
    process.env.IFS_DEFAULT_USER_ID ||
    (process as any).env?.PUBLIC_IFS_DEFAULT_USER_ID ||
    (process as any).env?.NEXT_PUBLIC_IFS_DEFAULT_USER_ID ||
    (process as any).env?.VITE_IFS_DEFAULT_USER_ID ||
    null,
  testPersonas: TEST_PERSONAS,
  currentPersona: (() => {
    const persona = 
      process.env.IFS_TEST_PERSONA ||
      (process as any).env?.PUBLIC_IFS_TEST_PERSONA ||
      (process as any).env?.NEXT_PUBLIC_IFS_TEST_PERSONA ||
      (process as any).env?.VITE_IFS_TEST_PERSONA ||
      'beginner'
    return ['beginner', 'moderate', 'advanced'].includes(persona) ? persona as TestPersona : 'beginner'
  })(),
  verbose: (() => {
    const val =
      process.env.IFS_VERBOSE ||
      (process as any).env?.PUBLIC_IFS_VERBOSE ||
      (process as any).env?.NEXT_PUBLIC_IFS_VERBOSE ||
      (process as any).env?.VITE_IFS_VERBOSE
    return val === 'true'
  })(),
  disablePolarizationUpdate: (() => {
    const val =
      process.env.IFS_DISABLE_POLARIZATION_UPDATE ||
      (process as any).env?.PUBLIC_IFS_DISABLE_POLARIZATION_UPDATE ||
      (process as any).env?.NEXT_PUBLIC_IFS_DISABLE_POLARIZATION_UPDATE ||
      (process as any).env?.VITE_IFS_DISABLE_POLARIZATION_UPDATE
    return val === 'true'
  })()
}

/**
 * Get the persona user ID for the current test persona
 * This function can be called from client-side code
 */
export function getPersonaUserId(persona?: TestPersona): string {
  const targetPersona = persona || developmentConfig.currentPersona
  return TEST_PERSONAS[targetPersona].id
}

/**
 * Get the current test persona from various sources (env, localStorage, etc.)
 * This is client-safe and handles browser vs server contexts
 */
export function getCurrentPersona(): TestPersona {
  if (typeof window !== 'undefined') {
    // Client-side: check localStorage first, then env
    const stored = localStorage.getItem('ifs-test-persona')
    if (stored && ['beginner', 'moderate', 'advanced'].includes(stored)) {
      return stored as TestPersona
    }
  }
  
  // Server-side or no localStorage: use env
  return developmentConfig.currentPersona
}

/**
 * Set the current test persona (client-side only)
 */
export function setCurrentPersona(persona: TestPersona): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ifs-test-persona', persona)
  }
}

/**
 * Get the user ID to use for tool execution
 * In development mode, uses persona system or falls back to defaultUserId
 * Otherwise requires explicit userId parameter
 */
export function resolveUserId(providedUserId?: string): string {
  if (providedUserId) {
    return providedUserId
  }
  
  if (developmentConfig.enabled) {
    // Use persona system if available
    const personaUserId = getPersonaUserId(getCurrentPersona())
    if (personaUserId) {
      if (developmentConfig.verbose) {
        const persona = getCurrentPersona()
        const personaConfig = TEST_PERSONAS[persona]
        console.log(`[IFS-DEV] Using persona user ID: ${personaUserId} (${personaConfig.name})`)
      }
      return personaUserId
    }
    
    // Fall back to legacy defaultUserId
    if (developmentConfig.defaultUserId) {
      if (developmentConfig.verbose) {
        console.log(`[IFS-DEV] Using default user ID: ${developmentConfig.defaultUserId}`)
      }
      return developmentConfig.defaultUserId
    }
  }
  
  throw new Error('User ID is required. Set IFS_TEST_PERSONA or IFS_DEFAULT_USER_ID environment variable for development mode.')
}

/**
 * Check if user confirmation is required
 * User confirmation is always required - should happen through chat interface
 */
export function requiresUserConfirmation(providedConfirmation?: boolean): boolean {
  return providedConfirmation !== true
}

/**
 * Log development actions if verbose mode is enabled
 */
export function devLog(message: string, data?: any): void {
  if (developmentConfig.enabled && developmentConfig.verbose) {
    console.log(`[IFS-DEV] ${message}`, data || '')
  }
}