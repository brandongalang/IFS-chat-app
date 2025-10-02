import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React from 'react'

Object.assign(process.env, { NODE_ENV: 'test' })
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.local'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon-key'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
const { window } = dom

function copyProps(src: Window, target: typeof globalThis) {
  Object.defineProperties(target, {
    ...Object.getOwnPropertyDescriptors(src),
    ...Object.getOwnPropertyDescriptors(target),
  })
}

function assignGlobal(key: string, value: unknown) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  })
}

assignGlobal('window', window)
assignGlobal('document', window.document)
assignGlobal('navigator', window.navigator)
assignGlobal('HTMLElement', window.HTMLElement)
assignGlobal('customElements', window.customElements)
assignGlobal('getComputedStyle', window.getComputedStyle.bind(window))
assignGlobal('localStorage', window.localStorage)
assignGlobal('MutationObserver', window.MutationObserver)
assignGlobal('React', React)
copyProps(window, globalThis)

if (!(globalThis as any).matchMedia) {
  ;(globalThis as any).matchMedia = () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false
    },
  })
}

if (!(globalThis as any).requestAnimationFrame) {
  ;(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0)
  ;(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id)
}

const { cleanup, renderHook, waitFor } = await import('@testing-library/react')
const { setBrowserClientOverrideForTests } = await import('@/lib/supabase/client')
const { useDailyCheckIns } = await import('@/hooks/useDailyCheckIns')

type TableData = {
  check_ins: Array<Record<string, unknown>>
}

const tableData: TableData = {
  check_ins: [],
}

const TEST_USER_ID = 'user-auth-id'

function setTableData(data: Partial<TableData>) {
  if (data.check_ins) {
    tableData.check_ins = data.check_ins
  }
}

function resetTableData() {
  tableData.check_ins = []
}

function pickColumns(row: Record<string, unknown>, columns?: string) {
  if (!columns || columns === '*' ) return row
  const names = columns.split(',').map((name) => name.trim())
  const picked: Record<string, unknown> = {}
  for (const name of names) {
    if (name in row) {
      picked[name] = row[name]
    }
  }
  return picked
}

function createQuery(columns?: string) {
  const filters = new Map<string, unknown>()
  const builder: any = {
    eq(column: string, value: unknown) {
      filters.set(column, value)
      return builder
    },
    // biome-ignore lint/suspicious/noThenProperty: test stub mimics Supabase thenable builders
    then(resolve: (value: unknown) => unknown, reject?: (reason?: unknown) => unknown) {
      const filtered = tableData.check_ins.filter((row) => {
        for (const [column, value] of filters.entries()) {
          if ((row as Record<string, unknown>)[column] !== value) return false
        }
        return true
      })
      const projected = filtered.map((row) => pickColumns(row as Record<string, unknown>, columns))
      return Promise.resolve({ data: projected, error: null }).then(resolve, reject)
    },
    catch(reject: (reason?: unknown) => unknown) {
      return Promise.resolve({ data: null, error: null }).catch(reject)
    },
  }

  return builder
}

const supabaseStub = {
  auth: {
    async getUser() {
      return { data: { user: { id: TEST_USER_ID } }, error: null }
    },
  },
  from() {
    return {
      select(columns?: string) {
        return createQuery(columns)
      },
    }
  },
}

setBrowserClientOverrideForTests(supabaseStub as any)

const RealDate = Date

function localDateString(d = new Date()) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function mockDateAtHour(hour: number) {
  const isoHour = String(hour).padStart(2, '0')
  const isoString = `2024-07-01T${isoHour}:00:00`
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
  ;(globalThis as any).Date = RealDate
}

process.on('exit', () => {
  setBrowserClientOverrideForTests(null)
})

test('returns morning available and evening locked during morning hours', async (t) => {
  mockDateAtHour(9)
  t.after(() => {
    cleanup()
    restoreDate()
    resetTableData()
  })

  setTableData({ check_ins: [] })

  const { result } = renderHook(() => useDailyCheckIns())

  await waitFor(() => {
    assert.equal(result.current.isLoading, false)
  })

  assert.equal(result.current.morning.status, 'available')
  assert.equal(result.current.evening.status, 'locked')
})

test('marks evening as available after 6pm when morning is complete', async (t) => {
  mockDateAtHour(18)
  t.after(() => {
    cleanup()
    restoreDate()
    resetTableData()
  })

  setTableData({
    check_ins: [
      { type: 'morning', user_id: TEST_USER_ID, check_in_date: localDateString(new Date()) },
    ],
  })

  const { result } = renderHook(() => useDailyCheckIns())

  await waitFor(() => {
    assert.equal(result.current.isLoading, false)
  })

  assert.equal(result.current.morning.status, 'completed')
  assert.equal(result.current.evening.status, 'available')
})

test('closes the morning slot after 6pm when no entry exists', async (t) => {
  mockDateAtHour(19)
  t.after(() => {
    cleanup()
    restoreDate()
    resetTableData()
  })

  setTableData({ check_ins: [] })

  const { result } = renderHook(() => useDailyCheckIns())

  await waitFor(() => {
    assert.equal(result.current.isLoading, false)
  })

  assert.equal(result.current.morning.status, 'closed')
  assert.equal(result.current.morning.canStart, false)
})
