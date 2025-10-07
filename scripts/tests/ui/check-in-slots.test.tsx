import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React from 'react'

Object.assign(process.env, { NODE_ENV: 'test' })

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
const { useDailyCheckIns } = await import('@/hooks/useDailyCheckIns')

type CheckInOverviewSlot = {
  status: 'completed' | 'available' | 'locked' | 'upcoming' | 'closed' | 'not_recorded'
  completed: boolean
  completedAt?: string | null
  availableAt?: string | null
}

type CheckInOverviewPayload = {
  morning: CheckInOverviewSlot
  evening: CheckInOverviewSlot
  streak: number
}

const baseSlot: CheckInOverviewSlot = {
  status: 'not_recorded',
  completed: false,
  completedAt: null,
  availableAt: null,
}

let currentPayload: CheckInOverviewPayload = {
  morning: { ...baseSlot },
  evening: { ...baseSlot },
  streak: 0,
}

const originalFetch = globalThis.fetch

globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => currentPayload,
}) as unknown as Response

function setOverview(partial: Partial<CheckInOverviewPayload>) {
  currentPayload = {
    morning: { ...baseSlot, ...(partial.morning ?? {}) },
    evening: { ...baseSlot, ...(partial.evening ?? {}) },
    streak: partial.streak ?? 0,
  }
}

process.on('exit', () => {
  cleanup()
  globalThis.fetch = originalFetch
})

test('returns morning available and evening locked when overview reports it', async (t) => {
  setOverview({
    morning: { status: 'available', completed: false },
    evening: { status: 'locked', completed: false, availableAt: '18:00' },
  })

  t.after(() => {
    cleanup()
  })

  const { result } = renderHook(() => useDailyCheckIns())

  await waitFor(() => {
    assert.equal(result.current.isLoading, false)
  })

  assert.equal(result.current.morning.status, 'available')
  assert.equal(result.current.morning.canStart, true)
  assert.equal(result.current.evening.status, 'locked')
  assert.equal(result.current.streak, 0)
})

test('marks evening as available when morning is completed', async (t) => {
  setOverview({
    morning: { status: 'completed', completed: true },
    evening: { status: 'available', completed: false },
    streak: 3,
  })

  t.after(() => {
    cleanup()
  })

  const { result } = renderHook(() => useDailyCheckIns())

  await waitFor(() => {
    assert.equal(result.current.isLoading, false)
  })

  assert.equal(result.current.morning.status, 'completed')
  assert.equal(result.current.morning.canStart, false)
  assert.equal(result.current.evening.status, 'available')
  assert.equal(result.current.streak, 3)
})

test('closes the morning slot when overview reports closed status', async (t) => {
  setOverview({
    morning: { status: 'closed', completed: false },
    evening: { status: 'available', completed: false },
  })

  t.after(() => {
    cleanup()
  })

  const { result } = renderHook(() => useDailyCheckIns())

  await waitFor(() => {
    assert.equal(result.current.isLoading, false)
  })

  assert.equal(result.current.morning.status, 'closed')
  assert.equal(result.current.morning.canStart, false)
})
