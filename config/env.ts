import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Providers / Secrets
  OPENROUTER_API_KEY: z.string().optional(),
  IFS_MODEL: z.string().default('google/gemini-2.5-flash-preview-09-2025'),
  IFS_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.3),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // IFS dev toggles
  IFS_DEV_MODE: z.string().optional(),
  NEXT_PUBLIC_IFS_DEV_MODE: z.string().optional(),
  IFS_TEST_PERSONA: z.enum(['beginner', 'moderate', 'advanced']).optional(),
  NEXT_PUBLIC_IFS_TEST_PERSONA: z.enum(['beginner', 'moderate', 'advanced']).optional(),
  IFS_DEFAULT_USER_ID: z.string().uuid().optional(),
  IFS_VERBOSE: z.string().optional(),
  IFS_DISABLE_POLARIZATION_UPDATE: z.string().optional(),
  IFS_ENABLE_MARKDOWN_CONTEXT: z.string().optional(),
  IFS_DEMO_AUTH_ENABLED: z.string().optional(),
  NEXT_PUBLIC_IFS_DEMO_AUTH_ENABLED: z.string().optional(),
  IFS_DEMO_AUTH_EMAIL: z.string().email().optional(),
  IFS_DEMO_AUTH_PASSWORD: z.string().optional(),
  // Dev overrides
  IFS_DEV_FORCE_NO_SUPABASE: z.string().optional(),

  // Memory / Storage
  MEMORY_AGENTIC_V2_ENABLED: z.string().optional(),
})

// Important: avoid parsing the entire process.env object because in the browser
// Next.js inlines only referenced variables and the runtime stub may be empty.
// Explicitly map the keys we care about instead, and keep this module server-only.
const raw = EnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,

  // Providers / Secrets
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  IFS_MODEL: process.env.IFS_MODEL || undefined,
  IFS_TEMPERATURE: process.env.IFS_TEMPERATURE,

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // IFS dev toggles
  IFS_DEV_MODE: process.env.IFS_DEV_MODE,
  NEXT_PUBLIC_IFS_DEV_MODE: process.env.NEXT_PUBLIC_IFS_DEV_MODE,
  IFS_TEST_PERSONA: process.env.IFS_TEST_PERSONA as any,
  NEXT_PUBLIC_IFS_TEST_PERSONA: process.env.NEXT_PUBLIC_IFS_TEST_PERSONA as any,
  IFS_DEFAULT_USER_ID: process.env.IFS_DEFAULT_USER_ID,
  IFS_VERBOSE: process.env.IFS_VERBOSE,
  IFS_DISABLE_POLARIZATION_UPDATE: process.env.IFS_DISABLE_POLARIZATION_UPDATE,
  IFS_ENABLE_MARKDOWN_CONTEXT: process.env.IFS_ENABLE_MARKDOWN_CONTEXT,
  IFS_DEMO_AUTH_ENABLED: process.env.IFS_DEMO_AUTH_ENABLED,
  NEXT_PUBLIC_IFS_DEMO_AUTH_ENABLED: process.env.NEXT_PUBLIC_IFS_DEMO_AUTH_ENABLED,
  IFS_DEMO_AUTH_EMAIL: process.env.IFS_DEMO_AUTH_EMAIL,
  IFS_DEMO_AUTH_PASSWORD: process.env.IFS_DEMO_AUTH_PASSWORD,
  // Dev overrides
  IFS_DEV_FORCE_NO_SUPABASE: process.env.IFS_DEV_FORCE_NO_SUPABASE,

  // Memory / Storage
  MEMORY_AGENTIC_V2_ENABLED: process.env.MEMORY_AGENTIC_V2_ENABLED,
})

const toBool = (v?: string) => v === 'true'

const devModeOverride =
  raw.IFS_DEV_MODE !== undefined
    ? toBool(raw.IFS_DEV_MODE)
    : raw.NEXT_PUBLIC_IFS_DEV_MODE !== undefined
      ? toBool(raw.NEXT_PUBLIC_IFS_DEV_MODE)
      : null

const defaultDevMode = raw.NODE_ENV === 'development' || raw.NODE_ENV === 'test'

export const ENV = raw

export const env = {
  ...raw,
  NEXT_PUBLIC_SUPABASE_URL: raw.NEXT_PUBLIC_SUPABASE_URL ?? '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: raw.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  isProd: raw.NODE_ENV === 'production',
  isDev: raw.NODE_ENV !== 'production',
  isTest: raw.NODE_ENV === 'test',
  // Enable IFS dev mode in development, tests, or when explicitly requested
  ifsDevMode: devModeOverride ?? defaultDevMode,
  ifsVerbose: toBool(raw.IFS_VERBOSE),
  ifsDisablePolarizationUpdate: toBool(raw.IFS_DISABLE_POLARIZATION_UPDATE),
  ifsMarkdownContextEnabled:
    raw.IFS_ENABLE_MARKDOWN_CONTEXT === undefined
      ? false
      : toBool(raw.IFS_ENABLE_MARKDOWN_CONTEXT),
  ifsDemoAuthEnabled:
    raw.IFS_DEMO_AUTH_ENABLED === undefined
      ? false
      : toBool(raw.IFS_DEMO_AUTH_ENABLED),
  nextPublicIfsDemoAuthEnabled:
    raw.NEXT_PUBLIC_IFS_DEMO_AUTH_ENABLED === undefined
      ? false
      : toBool(raw.NEXT_PUBLIC_IFS_DEMO_AUTH_ENABLED),
  ifsDemoAuthEmail: raw.IFS_DEMO_AUTH_EMAIL ?? null,
  ifsDemoAuthPassword: raw.IFS_DEMO_AUTH_PASSWORD ?? null,
  ifsForceNoSupabase:
    toBool(raw.IFS_DEV_FORCE_NO_SUPABASE) ||
    !raw.NEXT_PUBLIC_SUPABASE_URL ||
    !raw.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ifsModel: raw.IFS_MODEL,
  ifsTemperature: raw.IFS_TEMPERATURE,
  // Memory storage config
  memoryV2Enabled:
    raw.MEMORY_AGENTIC_V2_ENABLED === undefined
      ? true
      : !['0', 'false', 'no'].includes(raw.MEMORY_AGENTIC_V2_ENABLED.toLowerCase()),
}

export const OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1'
