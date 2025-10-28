import { env } from '@/config/env'

const DEFAULT_TOKENS_PER_SECOND = 12

const parseRate = (value: number | null) => {
  if (value === null || value === undefined) {
    return DEFAULT_TOKENS_PER_SECOND
  }
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }
  return value
}

export const chatStreamingConfig = {
  tokensPerSecond: parseRate(env.ifsStreamTokensPerSecond ?? null),
  defaultTokensPerSecond: DEFAULT_TOKENS_PER_SECOND,
} as const

export type ChatStreamingConfig = typeof chatStreamingConfig
