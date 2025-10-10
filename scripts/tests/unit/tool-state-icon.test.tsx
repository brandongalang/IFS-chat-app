import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'

;(globalThis as any).React = React

const { iconForToolState } = await import('@/components/ai-elements/tool')
const { XCircleIcon, Loader2 } = await import('lucide-react')

test('maps output-error and error-prefixed states to failure icon', () => {
  const directError = iconForToolState('output-error')
  assert.equal(directError.type, XCircleIcon)

  const prefixedError = iconForToolState('error-handled')
  assert.equal(prefixedError.type, XCircleIcon)
})

test('non-error states preserve existing icons', () => {
  const streamingIcon = iconForToolState('input-streaming')
  assert.equal(streamingIcon.type, Loader2)
})
