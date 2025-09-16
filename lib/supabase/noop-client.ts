import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const missingConfigMessage =
  'Supabase environment variables are not configured. Falling back to a no-op client. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable Supabase features.'

const missingConfigError = new Error(missingConfigMessage)

let warned = false

function warnOnce() {
  if (!warned && typeof console !== 'undefined') {
    console.warn(missingConfigMessage)
    warned = true
  }
}

function createNoopQueryBuilder(): any {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: unknown) => unknown, reject?: (reason?: unknown) => unknown) =>
          Promise.resolve({ data: null, error: missingConfigError }).then(resolve, reject)
      }
      if (prop === 'catch') {
        return (reject: (reason?: unknown) => unknown) =>
          Promise.reject(missingConfigError).catch(reject)
      }
      return (..._args: unknown[]) => createNoopQueryBuilder()
    },
  }

  return new Proxy({}, handler)
}

export function createNoopSupabaseClient(): SupabaseClient<Database> {
  warnOnce()

  const auth = {
    async getUser() {
      return { data: { user: null }, error: null }
    },
    async getSession() {
      return { data: { session: null }, error: null }
    },
    async signInWithPassword() {
      return { data: { user: null, session: null }, error: missingConfigError }
    },
    async signOut() {
      return { error: missingConfigError }
    },
    async signUp() {
      return { data: { user: null, session: null }, error: missingConfigError }
    },
    async resetPasswordForEmail() {
      return { data: {}, error: missingConfigError }
    },
    async updateUser() {
      return { data: { user: null }, error: missingConfigError }
    },
    async signInWithIdToken() {
      return { data: { user: null, session: null }, error: missingConfigError }
    },
    async exchangeCodeForSession() {
      return { data: { session: null }, error: missingConfigError }
    },
    async verifyOtp() {
      return { data: { session: null }, error: missingConfigError }
    },
  }

  const storage = {
    from() {
      return {
        async upload() {
          return { data: null, error: missingConfigError }
        },
        async download() {
          return { data: null, error: missingConfigError }
        },
        async remove() {
          return { data: null, error: missingConfigError }
        },
        async list() {
          return { data: [], error: missingConfigError }
        },
      }
    },
  }

  const functions = {
    async invoke() {
      return { data: null, error: missingConfigError }
    },
  }

  const noopClient = {
    auth,
    storage,
    functions,
    channel() {
      return {
        on() {
          return this
        },
        async subscribe() {
          return { data: { subscription: null }, error: missingConfigError }
        },
        unsubscribe() {
          return { data: null, error: missingConfigError }
        },
      }
    },
    removeChannel() {
      return true
    },
    removeAllChannels() {
      return true
    },
    from() {
      return createNoopQueryBuilder()
    },
    schema() {
      return this
    },
    rpc() {
      return createNoopQueryBuilder()
    },
  }

  return noopClient as unknown as SupabaseClient<Database>
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  return typeof url === 'string' && url.length > 0 && typeof anonKey === 'string' && anonKey.length > 0
}

export { missingConfigError as SUPABASE_NOT_CONFIGURED_ERROR }
