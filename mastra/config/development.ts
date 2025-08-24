/**
 * Development configuration for IFS Therapy tools
 * 
 * This configuration allows for testing tools without full authentication
 * by providing default values for required parameters like userId.
 */

export interface DevelopmentConfig {
  /** Enable development mode features */
  enabled: boolean
  /** Default user ID to use when none is provided (for testing) */
  defaultUserId: string | null
  /** Log all tool executions for debugging */
  verbose: boolean
  /** In dev, skip updating polarization_level to avoid tsx runtime quirk */
  disablePolarizationUpdate: boolean
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
 * Get the user ID to use for tool execution
 * In development mode with defaultUserId configured, returns the default
 * Otherwise requires explicit userId parameter
 */
export function resolveUserId(providedUserId?: string): string {
  if (providedUserId) {
    return providedUserId
  }
  
  if (developmentConfig.enabled && developmentConfig.defaultUserId) {
    if (developmentConfig.verbose) {
      console.log(`[IFS-DEV] Using default user ID: ${developmentConfig.defaultUserId}`)
    }
    return developmentConfig.defaultUserId
  }
  
  throw new Error('User ID is required. Set IFS_DEFAULT_USER_ID environment variable for development mode.')
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