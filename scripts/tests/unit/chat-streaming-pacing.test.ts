import { createStreamPacer, estimateTokenCount } from '@/app/api/chat/stream-pacing'

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  let currentTime = 0
  const delays: number[] = []
  const pacer = createStreamPacer({
    tokensPerSecond: 20,
    now: () => currentTime,
    sleep: async (ms: number) => {
      delays.push(ms)
      currentTime += ms
    },
  })

  await pacer('gentle pace')
  await pacer('for a calmer chat stream')

  assert(delays.length === 2, `Expected two pacing delays, received ${delays.length}`)
  assert(Math.abs(delays[0] - 150) < 1, `First delay should be ~150ms, got ${delays[0]}`)
  assert(Math.abs(delays[1] - 300) < 1, `Second delay should be ~300ms, got ${delays[1]}`)

  const immediate = createStreamPacer({ tokensPerSecond: 0 })
  const before = currentTime
  await immediate('no delay expected')
  assert(currentTime === before, 'Zero rate should short-circuit pacing')

  assert(estimateTokenCount('') === 0, 'Empty text should produce zero tokens')
  assert(estimateTokenCount('hello') === 2, 'Short word should round up to at least one token')
  assert(estimateTokenCount('This has quite a few words in it.') >= 6, 'Longer strings should return higher token estimates')

  console.log('chat-streaming pacing tests passed')
}

main().catch((error) => {
  console.error('chat-streaming pacing test failed:', error)
  process.exit(1)
})
