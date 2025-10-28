export interface StreamPacerOptions {
  tokensPerSecond: number | null | undefined
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const defaultNow = () => Date.now()

export const estimateTokenCount = (text: string): number => {
  const normalized = text.trim()
  if (!normalized) return 0
  return Math.max(1, Math.ceil(normalized.length / 4))
}

export function createStreamPacer(options: StreamPacerOptions): (delta: string) => Promise<void> {
  const { tokensPerSecond, sleep = defaultSleep, now = defaultNow } = options
  if (!tokensPerSecond || !Number.isFinite(tokensPerSecond) || tokensPerSecond <= 0) {
    return async () => {}
  }

  let lastTimestamp = now()

  return async (delta: string) => {
    const tokenEstimate = estimateTokenCount(delta)
    if (tokenEstimate === 0) {
      return
    }

    const desiredDelay = (tokenEstimate / tokensPerSecond) * 1000
    const elapsed = now() - lastTimestamp
    const waitTime = desiredDelay - elapsed

    if (waitTime > 1) {
      await sleep(waitTime)
    }

    lastTimestamp = now()
  }
}
