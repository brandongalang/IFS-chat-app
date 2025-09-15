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

;(globalThis as any).window = window
;(globalThis as any).document = window.document
;(globalThis as any).navigator = window.navigator
;(globalThis as any).HTMLElement = window.HTMLElement
;(globalThis as any).customElements = window.customElements
;(globalThis as any).getComputedStyle = window.getComputedStyle.bind(window)
;(globalThis as any).localStorage = window.localStorage
;(globalThis as any).MutationObserver = window.MutationObserver
;(globalThis as any).React = React
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

const { ComingSoonProvider } = await import('@/components/common/ComingSoonProvider')
const { CheckInCard } = await import('@/components/home/CheckInCard')

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

test('renders the morning check-in entry point with navigation link', async (t) => {
  mockDateAtHour(9)
  t.after(() => {
    cleanup()
    restoreDate()
  })

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
  })

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
  })

  renderCard()

  const message = screen.getByText('Come back later')
  assert.ok(message)
  const link = screen.queryByRole('link', { name: /begin/i })
  assert.equal(link, null)
})
