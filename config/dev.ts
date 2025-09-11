import { env } from './env'
import { isDevMode } from './features'
import { TEST_PERSONAS, getPersonaUserId, getCurrentPersona, type TestPersona } from './personas'

// Compute dev flags using centralized environment parsing so behaviour
// stays consistent between local tests and deployed environments.
const currentPersonaEnv = (env.IFS_TEST_PERSONA ?? env.NEXT_PUBLIC_IFS_TEST_PERSONA ?? 'beginner') as TestPersona

export const dev = {
  enabled: isDevMode(),
  defaultUserId: env.IFS_DEFAULT_USER_ID ?? null,
  verbose: env.ifsVerbose,
  disablePolarizationUpdate: env.ifsDisablePolarizationUpdate,
  currentPersona: currentPersonaEnv,
}

export function resolveUserId(providedUserId?: string): string {
  if (dev.enabled) {
    // Prefer client-selected persona when available
    const persona = typeof window !== 'undefined' ? getCurrentPersona() : dev.currentPersona
    const personaUserId = getPersonaUserId(persona)
    if (personaUserId) {
      if (dev.verbose) {
        const cfg = TEST_PERSONAS[persona]
        console.log(`[IFS-DEV] Using persona user ID: ${personaUserId} (${cfg.name})`)
      }
      return personaUserId
    }
    if (dev.defaultUserId) {
      if (dev.verbose) console.log(`[IFS-DEV] Using default user ID: ${dev.defaultUserId}`)
      return dev.defaultUserId
    }
    throw new Error('User ID is required. Set IFS_TEST_PERSONA or IFS_DEFAULT_USER_ID for development mode.')
  }
  if (providedUserId) return providedUserId
  throw new Error('User ID is required. Set IFS_TEST_PERSONA or IFS_DEFAULT_USER_ID for development mode.')
}

export function requiresUserConfirmation(providedConfirmation?: boolean): boolean {
  return providedConfirmation !== true
}

export function devLog(message: string, data?: any): void {
  if (dev.enabled && dev.verbose) {
    console.log(`[IFS-DEV] ${message}`, data || '')
  }
}
