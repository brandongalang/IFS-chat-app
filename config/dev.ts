import { TEST_PERSONAS, getPersonaUserId, getCurrentPersona, type TestPersona } from './personas'

// Compute dev flags in a way that works in both server and browser.
// On the browser, NEXT_PUBLIC_* vars are inlined by Next.js at build time.
const isProd = process.env.NODE_ENV === 'production'
const publicDev = process.env.NEXT_PUBLIC_IFS_DEV_MODE === 'true'
const serverDev = process.env.IFS_DEV_MODE === 'true'
const enabled = !isProd && (publicDev || serverDev)

const defaultUserId = process.env.IFS_DEFAULT_USER_ID ?? null
const verbose = process.env.IFS_VERBOSE === 'true'
const disablePolarizationUpdate = process.env.IFS_DISABLE_POLARIZATION_UPDATE === 'true'
const currentPersonaEnv = (process.env.IFS_TEST_PERSONA ?? process.env.NEXT_PUBLIC_IFS_TEST_PERSONA ?? 'beginner') as TestPersona

export const dev = {
  enabled,
  defaultUserId,
  verbose,
  disablePolarizationUpdate,
  currentPersona: currentPersonaEnv,
}

export function resolveUserId(providedUserId?: string): string {
  if (providedUserId) return providedUserId

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
  }
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
