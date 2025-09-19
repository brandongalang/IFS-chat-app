import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React from 'react'

process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.local'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon-key'
process.env.IFS_TEST_PERSONA = 'beginner'

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
if (!(globalThis as any).matchMedia) {
  ;(globalThis as any).matchMedia = () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false },
  })
}
if (!(globalThis as any).requestAnimationFrame) {
  ;(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0)
  ;(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id)
}

copyProps(window, globalThis)

const { cleanup, render, screen } = await import('@testing-library/react')

const { setBrowserClientOverrideForTests } = await import('@/lib/supabase/client')
const { ComingSoonProvider } = await import('@/components/common/ComingSoonProvider')
const { CheckInCard } = await import('@/components/home/CheckInCard')

type TableData = {
  check_ins: Array<Record<string, unknown>>
  sessions: Array<Record<string, unknown>>
}

const tableData: TableData = {
  check_ins: [],
  sessions: [],
}

const TEST_USER_ID = 'user-auth-id'

function setTableData(data: Partial<TableData>) {
  if (data.check_ins) {
    tableData.check_ins = data.check_ins
  }
  if (data.sessions) {
    tableData.sessions = data.sessions
  }
}

function resetTableData() {
  tableData.check_ins = []
  tableData.sessions = []
}

function pickColumns(row: Record<string, unknown>, columns?: string) {
  if (!columns) return row
  if (columns === '*') return row
  const names = columns.split(',').map((col) => col.trim())
  const picked: Record<string, unknown> = {}
  for (const name of names) {
    if (name in row) {
      picked[name] = row[name]
    }
  }
  return picked
}

function createQuery(table: keyof TableData, columns?: string) {
  const filters = new Map<string, unknown>()
  const builder: any = {
    eq(column: string, value: unknown) {
      filters.set(column, value)
      return builder
    },
    order() {
      return builder
    },
    limit() {
      return builder
    },
    then(resolve: (value: unknown) => unknown, reject?: (reason?: unknown) => unknown) {
      const rows = tableData[table]
      const filtered = rows.filter((row) => {
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
  from(table: keyof TableData) {
    return {
      select(columns?: string) {
        return createQuery(table, columns)
      },
    }
  },
}

setBrowserClientOverrideForTests(supabaseStub as any)

const RealDate = Date

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

function renderCard() {
  return render(
    <ComingSoonProvider>
      <CheckInCard />
    </ComingSoonProvider>
  )
}

function setCheckIns(rows: Array<Record<string, unknown>>) {
  setTableData({ check_ins: rows })
}

function clearData() {
  resetTableData()
}

process.on('exit', () => {
  setBrowserClientOverrideForTests(null)
})

test('renders the morning check-in entry point with navigation link', async (t) => {
  mockDateAtHour(9)
  t.after(() => {
    cleanup()
    restoreDate()
    clearData()
  })

  setCheckIns([])
  renderCard()

  const title = await screen.findByText('Fresh start!')
  assert.ok(title)
  const link = await screen.findByRole('link', { name: /begin/i })
  assert.equal(link.getAttribute('href'), '/check-in')
})

test('renders the evening variant during evening hours', async (t) => {
  mockDateAtHour(18)
  t.after(() => {
    cleanup()
    restoreDate()
    clearData()
  })

  setCheckIns([
    { type: 'morning', user_id: TEST_USER_ID, check_in_date: '2024-07-01' },
  ])
  renderCard()

  const label = await screen.findByText('Daily review')
  assert.ok(label)
  await screen.findByText('Evening')
})

test('hides the call-to-action outside check-in windows', async (t) => {
  mockDateAtHour(13)
  t.after(() => {
    cleanup()
    restoreDate()
    clearData()
  })

  setCheckIns([])
  renderCard()

  const message = await screen.findByText('Come back later')
  assert.ok(message)
  const link = screen.queryByRole('link', { name: /begin/i })
  assert.equal(link, null)
})
