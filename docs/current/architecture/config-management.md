---
title: Configuration Management
category: architecture
status: active
last_updated: 2025-10-23
---

# Configuration Management

This document explains how configuration is managed in the IFS Therapy app.

## Overview

The app uses a **centralized configuration system** with type-safe validation via Zod schemas. All environment variables are parsed, validated, and exported through `config/env.ts`.

## Architecture

```text
┌─────────────────────────────────────┐
│  .env.local / process.env           │
│  (Raw environment variables)        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  config/env.ts                      │
│  • Zod schema validation            │
│  • Type conversions                 │
│  • Smart defaults                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Exported config object             │
│  • env.memoryStorageAdapter         │
│  • env.ifsDevMode                   │
│  • env.ifsModel                     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Feature modules                    │
│  • config/features.ts               │
│  • config/dev.ts                    │
│  • lib/memory/config.ts             │
└─────────────────────────────────────┘
```

## Configuration Files

### `config/env.ts` (Central Hub)

**Purpose**: Single source of truth for all environment configuration

```typescript
// Example usage
import { env } from '@/config/env'
const storageMode = env.memoryStorageAdapter
```

**Features**:
- ✅ Zod schema validation
- ✅ Type-safe exports
- ✅ Smart defaults
- ✅ Runtime validation
- ✅ Boolean parsing helpers

**Example**:
```typescript
import { env } from '@/config/env'

// Type-safe access
const storageMode = env.memoryStorageAdapter  // currently always 'supabase'
const isDevMode = env.ifsDevMode             // boolean
const model = env.ifsModel                   // string
```

### `config/features.ts`

**Purpose**: Feature flag management

- Determines which features are enabled/disabled
- Handles dev mode overrides
- Supports client-side localStorage overrides
- Used by navigation and routing

### `config/dev.ts`

**Purpose**: Development mode utilities

- Test persona management
- User ID resolution for dev/test
- Verbose logging helpers
- Development shortcuts

### `lib/memory/config.ts`

**Purpose**: Memory system configuration

- Storage mode (now fixed to Supabase)
- Memory V2 feature flag
- Storage paths and bucket names

## Environment Variables

### Memory / Storage

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MEMORY_STORAGE_ADAPTER` | `'supabase'` | `'supabase'` | Storage backend for Memory V2 markdown files (fixed) |
| `MEMORY_LOCAL_ROOT` | `string` | `'.data/memory-snapshots'` | Legacy local filesystem root (deprecated) |
| `MEMORY_AGENTIC_V2_ENABLED` | `string` | `true` | Enable Memory V2 system (markdown-based) |

### AI / Model

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `IFS_MODEL` | `string` | `'google/gemini-2.5-flash-preview-09-2025'` | AI model to use via OpenRouter |
| `IFS_TEMPERATURE` | `number` | `0.3` | Temperature for AI responses (0-2) |
| `OPENROUTER_API_KEY` | `string` | - | OpenRouter API key (required) |

### Supabase

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `string` | - | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `string` | - | Supabase anonymous key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | `string` | - | Supabase service role key (server-only) |
| `NEXT_PUBLIC_PROD_SUPABASE_URL` | `string` | - | Production Supabase URL for browser/server fallbacks |
| `NEXT_PUBLIC_PROD_SUPABASE_ANON_KEY` | `string` | - | Production Supabase anon key for browser usage |

### Development

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `IFS_DEV_MODE` | `boolean` | `NODE_ENV !== 'production'` | Enable development mode features |
| `IFS_TEST_PERSONA` | `'beginner' \| 'moderate' \| 'advanced'` | `'beginner'` | Test persona to use |
| `IFS_DEFAULT_USER_ID` | `uuid` | - | Default user ID for testing |
| `IFS_VERBOSE` | `boolean` | `false` | Enable verbose logging |
| `NEXT_PUBLIC_TARGET_ENV` / `TARGET_ENV` | `string` | *(unset)* | Set to `prod` locally to target production Supabase; leave unset in deployed environments |

## Best Practices

### ✅ Do This

```typescript
// Import from centralized config
import { env } from '@/config/env'

function setupStorage() {
  const mode = env.memoryStorageAdapter
  if (mode === 'supabase') {
    // Use Supabase storage
  }
}
```

### ❌ Don't Do This

```typescript
// Don't access process.env directly
function setupStorage() {
  const mode = process.env.MEMORY_STORAGE_ADAPTER
  // ❌ No type safety
  // ❌ No validation
  // ❌ No default values
}
```

## Adding New Configuration

When adding new configuration:

1. **Add to Zod schema** in `config/env.ts`:
   ```typescript
   const EnvSchema = z.object({
     // ... existing fields
     MY_NEW_CONFIG: z.string().default('default-value'),
   })
   ```

2. **Parse in raw config**:
   ```typescript
   const raw = EnvSchema.parse({
     // ... existing mappings
     MY_NEW_CONFIG: process.env.MY_NEW_CONFIG,
   })
   ```

3. **Export typed value**:
   ```typescript
   export const env = {
     // ... existing exports
     myNewConfig: raw.MY_NEW_CONFIG,
   }
   ```

4. **Use in your code**:
   ```typescript
   import { env } from '@/config/env'
   const value = env.myNewConfig
   ```

## Migration from Direct `process.env`

If you find code that accesses `process.env` directly:

1. Check if the variable is already in `config/env.ts`
2. If yes, import and use `env` object
3. If no, add it following the steps above
4. Update the code to use the centralized config

## Testing

Configuration can be mocked in tests:

```typescript
import { env } from '@/config/env'

// Mock the entire env object
jest.mock('@/config/env', () => ({
  env: {
    memoryStorageAdapter: 'local',
    ifsDevMode: true,
    // ... other mocked values
  }
}))
```

## Security

- **Public variables**: Prefixed with `NEXT_PUBLIC_` can be accessed in browser
- **Secret variables**: Without prefix are server-only
- **Service role keys**: Never expose to client code
- **Validation**: Zod catches missing required values at startup

## Related Files

- `config/env.ts` - Central configuration hub
- `config/features.ts` - Feature flags
- `config/dev.ts` - Development utilities
- `lib/memory/config.ts` - Memory system config
- `.env.local` - Local environment variables (git-ignored)
- `.env.example` - Template for required variables
