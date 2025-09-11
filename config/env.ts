import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Providers / Secrets
  OPENROUTER_API_KEY: z.string().optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // IFS dev toggles
  IFS_DEV_MODE: z.string().optional(),
  NEXT_PUBLIC_IFS_DEV_MODE: z.string().optional(),
  IFS_TEST_PERSONA: z.enum(['beginner','moderate','advanced']).optional(),
  NEXT_PUBLIC_IFS_TEST_PERSONA: z.enum(['beginner','moderate','advanced']).optional(),
  IFS_DEFAULT_USER_ID: z.string().uuid().optional(),
  IFS_VERBOSE: z.string().optional(),
  IFS_DISABLE_POLARIZATION_UPDATE: z.string().optional(),
})

const raw = EnvSchema.parse(process.env)

const toBool = (v?: string) => v === 'true'

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === 'production',
  isDev: raw.NODE_ENV !== 'production',
  isTest: raw.NODE_ENV === 'test',
  // Enable IFS dev mode in development, tests, or when explicitly requested
  ifsDevMode:
    raw.NODE_ENV === 'development' ||
    raw.NODE_ENV === 'test' ||
    toBool(raw.IFS_DEV_MODE) ||
    toBool(raw.NEXT_PUBLIC_IFS_DEV_MODE),
  ifsVerbose: toBool(raw.IFS_VERBOSE),
  ifsDisablePolarizationUpdate: toBool(raw.IFS_DISABLE_POLARIZATION_UPDATE),
}
