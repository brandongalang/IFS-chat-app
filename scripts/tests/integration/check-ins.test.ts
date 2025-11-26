import test from 'node:test'
import assert from 'node:assert/strict'
import { setAdminClientOverrideForTests } from '@/lib/supabase/admin'
import { setServerClientOverrideForTests } from '@/lib/supabase/server'

Object.assign(process.env, { NODE_ENV: 'test' })
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.local'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
process.env.IFS_TEST_PERSONA = 'beginner'

interface SupabaseResult<T = any> {
  data: T
  error: { code?: string; message?: string } | null
}

type SupabaseInsertHandler = (
  table: string,
  payload: Record<string, any>,
) => Promise<SupabaseResult>
type SupabaseSelectHandler = (
  params: {
    table: string
    columns?: string
    filters: Array<{ column: string; value: unknown }>
    order?: { column: string; ascending: boolean }
    limit?: number
  },
) => Promise<SupabaseResult>
type SupabaseUpdateHandler = (
  params: {
    table: string
    payload: Record<string, any>
    filters: Array<{ column: string; value: unknown }>
  },
) => Promise<SupabaseResult>

const defaultInsertHandler: SupabaseInsertHandler = async () => {
  throw new Error('supabase insert handler not set for test')
}

const defaultSelectHandler: SupabaseSelectHandler = async () => ({ data: [], error: null })

const defaultUpdateHandler: SupabaseUpdateHandler = async () => ({ data: null, error: null })

let supabaseInsertImpl: SupabaseInsertHandler = defaultInsertHandler
let supabaseSelectImpl: SupabaseSelectHandler = defaultSelectHandler
let supabaseUpdateImpl: SupabaseUpdateHandler = defaultUpdateHandler

function createQueryBuilder(table: string) {
  return {
    insert(payload: Record<string, any>) {
      return {
        async select() {
          return supabaseInsertImpl(table, payload)
        },
      }
    },
    select(columns?: string) {
      const filters: Array<{ column: string; value: unknown }> = []
      const builder = {
        eq(column: string, value: unknown) {
          filters.push({ column, value })
          return builder
        },
        order(column: string, options?: { ascending?: boolean }) {
          builder._order = { column, ascending: options?.ascending ?? true }
          return builder
        },
        limit(limit: number) {
          return supabaseSelectImpl({
            table,
            columns,
            filters,
            order: builder._order,
            limit,
          })
        },
        _order: undefined as { column: string; ascending: boolean } | undefined,
      }

      return builder
    },
    update(payload: Record<string, any>) {
      const filters: Array<{ column: string; value: unknown }> = []
      return {
        eq(column: string, value: unknown) {
          filters.push({ column, value })
          return supabaseUpdateImpl({ table, payload, filters })
        },
      }
    },
  }
}

const adminClient = {
  from(table: string) {
    return createQueryBuilder(table)
  },
}

const serverClient = {
  auth: {
    async getUser() {
      return { data: { user: { id: 'user-auth-id' } } }
    },
  },
  from(table: string) {
    return createQueryBuilder(table)
  },
}

setAdminClientOverrideForTests(adminClient as any)
setServerClientOverrideForTests(serverClient as any)

process.on('exit', () => {
  setAdminClientOverrideForTests(null)
  setServerClientOverrideForTests(null)
})

const { POST } = await import('@/app/api/check-ins/route')

function createRequest(body: Record<string, any>) {
  return {
    async json() {
      return body
    },
  } as any
}

test('creates a morning check-in via the API', async (t) => {
  supabaseInsertImpl = async (_table, payload) => {
    assert.equal(payload.type, 'morning')
    assert.equal(payload.mood, 3)
    assert.equal(payload.energy_level, 3)
    assert.equal(payload.user_id, '11111111-1111-1111-1111-111111111111')
    assert.equal(payload.intention, 'Set a calm tone')
    const daily = (payload.parts_data?.daily_responses ?? {}) as Record<string, any>
    assert.equal(daily.variant, 'morning')
    assert.equal(daily.intention, 'Set a calm tone')
    assert.equal(daily.generatedEveningPrompt.text, 'What stood out for you today?')
    return { data: [{ id: 'check-in-1', ...payload }], error: null }
  }

  t.after(() => {
    supabaseInsertImpl = defaultInsertHandler
    supabaseSelectImpl = defaultSelectHandler
  })

  const res = await POST(
    createRequest({
      type: 'morning',
      mood: 'steady',
      energy: 'steady',
      mindForToday: 'Team sync later',
      intention: 'Set a calm tone',
      parts: ['part-1'],
    }),
  )

  assert.equal(res.status, 201)
  const json = await res.json()
  assert.ok(Array.isArray(json))
  assert.equal(json[0].id, 'check-in-1')
  assert.equal(json[0].type, 'morning')
})

test('creates an evening check-in via the API', async (t) => {
  supabaseSelectImpl = async () => ({
    data: [
      {
        id: 'morning-id',
        parts_data: {
          daily_responses: {
            variant: 'morning',
            generatedEveningPrompt: { text: 'What stood out for you today?' },
          },
        },
      },
    ],
    error: null,
  })

  supabaseInsertImpl = async (_table, payload) => {
    assert.equal(payload.type, 'evening')
    assert.equal(payload.reflection, 'Day went well')
    assert.equal(payload.wins, 'Had a productive meeting')
    assert.equal(payload.gratitude, 'Supportive friends')
    const daily = (payload.parts_data?.daily_responses ?? {}) as Record<string, any>
    assert.equal(daily.variant, 'evening')
    assert.equal(daily.reflection, 'Day went well')
    assert.equal(daily.wins, 'Had a productive meeting')
    assert.equal(daily.gratitude, 'Supportive friends')
    assert.equal(daily.reflectionPrompt.text, 'What stood out for you today?')
    return { data: [{ id: 'check-in-2', ...payload }], error: null }
  }

  supabaseUpdateImpl = async () => ({ data: null, error: null })

  t.after(() => {
    supabaseInsertImpl = defaultInsertHandler
    supabaseSelectImpl = defaultSelectHandler
    supabaseUpdateImpl = defaultUpdateHandler
  })

  const res = await POST(
    createRequest({
      type: 'evening',
      mood: 'bright',
      energy: 'spark',
      reflectionPrompt: 'What stood out for you today?',
      reflection: 'Day went well',
      wins: 'Had a productive meeting',
      gratitude: 'Supportive friends',
      parts: ['part-1'],
    }),
  )

  assert.equal(res.status, 201)
  const json = await res.json()
  assert.equal(json[0].type, 'evening')
})

test('rejects submissions without a valid type', async (t) => {
  supabaseInsertImpl = async () => {
    throw new Error('insert should not be called when validation fails')
  }

  t.after(() => {
    supabaseInsertImpl = defaultInsertHandler
  })

  const res = await POST(createRequest({ mood: 5 }))
  assert.equal(res.status, 400)
  const json = await res.json()
  assert.equal(json.error, 'Invalid check-in type')
})

test('surfaces duplicate submission errors from Supabase', async (t) => {
  supabaseInsertImpl = async () => {
    return {
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    }
  }

  t.after(() => {
    supabaseInsertImpl = defaultInsertHandler
  })

  const res = await POST(
    createRequest({ type: 'morning', mood: 'steady', energy: 'steady', intention: 'Stay calm' }),
  )
  assert.equal(res.status, 409)
  const json = await res.json()
  assert.equal(json.error, 'A check-in of this type already exists for this date.')
})
