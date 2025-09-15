import test from 'node:test'
import assert from 'node:assert/strict'
import { setAdminClientOverrideForTests } from '@/lib/supabase/admin'
import { setServerClientOverrideForTests } from '@/lib/supabase/server'

process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.local'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
process.env.IFS_TEST_PERSONA = 'beginner'

interface SupabaseInsertResult {
  data: any
  error: { code?: string; message?: string } | null
}

type SupabaseInsertHandler = (payload: Record<string, any>) => Promise<SupabaseInsertResult>

const defaultHandler: SupabaseInsertHandler = async () => {
  throw new Error('supabase insert handler not set for test')
}

let supabaseInsertImpl: SupabaseInsertHandler = defaultHandler

const adminClient = {
  from() {
    return {
      insert(payload: Record<string, any>) {
        return {
          async select() {
            return supabaseInsertImpl(payload)
          },
        }
      },
    }
  },
}

const serverClient = {
  auth: {
    async getUser() {
      return { data: { user: { id: 'user-auth-id' } } }
    },
  },
  from() {
    return {
      insert(payload: Record<string, any>) {
        return {
          async select() {
            return supabaseInsertImpl(payload)
          },
        }
      },
    }
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
  const morningResponses = {
    intention: 'Set a calm tone',
    worries: 'Feeling anxious about the presentation',
    lookingForwardTo: 'Catching up with a friend over coffee',
  }

  supabaseInsertImpl = async (payload) => {
    assert.equal(payload.type, 'morning')
    assert.equal(payload.user_id, '11111111-1111-1111-1111-111111111111')
    assert.deepEqual(payload.parts_data?.daily_responses, morningResponses)
    assert.equal(payload.processed, false)
    return { data: [{ id: 'check-in-1', ...payload }], error: null }
  }

  t.after(() => {
    supabaseInsertImpl = defaultHandler
  })

  const res = await POST(
    createRequest({
      type: 'morning',
      responses: morningResponses,
    })
  )

  assert.equal(res.status, 201)
  const json = await res.json()
  assert.ok(Array.isArray(json))
  assert.equal(json[0].id, 'check-in-1')
  assert.equal(json[0].type, 'morning')
})

test('creates an evening check-in via the API', async (t) => {
  const eveningResponses = {
    reflectionOnIntention: 'I stayed mostly aligned with it',
    reflectionOnWorries: 'It turned out better than expected',
    reflectionOnLookingForwardTo: 'The dinner was relaxing and fun',
  }

  supabaseInsertImpl = async (payload) => {
    assert.equal(payload.type, 'evening')
    assert.equal(payload.gratitude, 'Supportive friends')
    assert.deepEqual(payload.parts_data?.daily_responses, eveningResponses)
    assert.equal(payload.processed, false)
    return { data: [{ id: 'check-in-2', ...payload }], error: null }
  }

  t.after(() => {
    supabaseInsertImpl = defaultHandler
  })

  const res = await POST(
    createRequest({
      type: 'evening',
      gratitude: 'Supportive friends',
      responses: eveningResponses,
    })
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
    supabaseInsertImpl = defaultHandler
  })

  const res = await POST(createRequest({ responses: {} }))
  assert.equal(res.status, 400)
  const json = await res.json()
  assert.equal(json.error, 'Invalid check-in type')
})

test('surfaces duplicate submission errors from Supabase', async (t) => {
  supabaseInsertImpl = async () => {
    return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
  }

  t.after(() => {
    supabaseInsertImpl = defaultHandler
  })

  const res = await POST(createRequest({ type: 'morning', responses: {} }))
  assert.equal(res.status, 409)
  const json = await res.json()
  assert.equal(json.error, 'A check-in of this type already exists for this date.')
})
