import test from 'node:test'
import assert from 'node:assert/strict'
import { setServerClientOverrideForTests } from '@/lib/supabase/server'

process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.local'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon-key'

type CheckInType = 'morning' | 'evening'

type Session = { user: { id: string } }

const state: {
  session: Session | null
  checkIns: { type: CheckInType }[]
  queryError: { message: string } | null
} = {
  session: { user: { id: 'user-123' } },
  checkIns: [],
  queryError: null,
}

const supabaseStub = {
  auth: {
    async getSession() {
      return { data: { session: state.session }, error: null }
    },
  },
  from() {
    const query = {
      eq() {
        return query
      },
      then(onFulfilled: any, onRejected?: any) {
        const result =
          state.queryError === null
            ? { data: state.checkIns, error: null }
            : { data: null, error: state.queryError }
        return Promise.resolve(result).then(onFulfilled, onRejected)
      },
    }

    return {
      select() {
        return query
      },
    }
  },
}

setServerClientOverrideForTests(supabaseStub as any)

process.on('exit', () => {
  setServerClientOverrideForTests(null)
})

const RealDate = Date

function mockDateAtHour(hour: number) {
  const isoHour = String(hour).padStart(2, '0')
  const isoString = `2025-01-15T${isoHour}:00:00.000Z`

  class MockDate extends RealDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(isoString)
      } else {
        super(...(args as [any]))
      }
    }

    static now() {
      return new RealDate(isoString).getTime()
    }
  }

  ;(globalThis as any).Date = MockDate as unknown as DateConstructor
}

function restoreDate() {
  ;(globalThis as any).Date = RealDate as unknown as DateConstructor
}

const { default: CheckInPage } = await import('@/app/check-in/page')

async function expectRedirect(url: string) {
  try {
    await CheckInPage()
    assert.fail('Expected redirect to throw')
  } catch (error) {
    assert.ok(error instanceof Error)
    const digest = (error as Error & { digest?: string }).digest
    assert.equal(typeof digest, 'string')
    const parts = (digest ?? '').split(';')
    assert.equal(parts[0], 'NEXT_REDIRECT')
    assert.equal(parts[2], url)
  }
}

test('redirects to the morning flow during morning hours without entries', { concurrency: false }, async (t) => {
  state.session = { user: { id: 'user-123' } }
  state.checkIns = []
  state.queryError = null
  mockDateAtHour(9)

  t.after(() => {
    restoreDate()
  })

  await expectRedirect('/check-in/morning')
})

test('redirects to evening when the morning check-in exists and it is evening hours', { concurrency: false }, async (t) => {
  state.session = { user: { id: 'user-123' } }
  state.checkIns = [{ type: 'morning' }]
  state.queryError = null
  mockDateAtHour(18)

  t.after(() => {
    restoreDate()
  })

  await expectRedirect('/check-in/evening')
})

test('falls back to the morning form outside check-in windows', { concurrency: false }, async (t) => {
  state.session = { user: { id: 'user-123' } }
  state.checkIns = [{ type: 'morning' }]
  state.queryError = null
  mockDateAtHour(13)

  t.after(() => {
    restoreDate()
  })

  await expectRedirect('/check-in/morning')
})

test('uses time-of-day when Supabase returns an error', { concurrency: false }, async (t) => {
  state.session = { user: { id: 'user-123' } }
  state.checkIns = []
  state.queryError = { message: 'boom' }
  mockDateAtHour(18)

  t.after(() => {
    restoreDate()
    state.queryError = null
  })

  await expectRedirect('/check-in/evening')
})
