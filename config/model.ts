export const MODEL_MAP = {
  'grok-4-fast': { id: 'x-ai/grok-4-fast' },
  'glm-4.5-air': { id: 'z-ai/glm-4.5-air' },
  'claude-3.7-sonnet': { id: 'anthropic/claude-3-7-sonnet' },
  'o3-mini': { id: 'openai/o3-mini' },
} as const

export type ModelKey = keyof typeof MODEL_MAP
export type ModelId = string

export function resolveModel(key?: string): ModelId {
  if (!key) {
    return MODEL_MAP['grok-4-fast'].id
  }

  const normalized = key.trim()
  if (normalized.includes('/')) {
    return normalized as ModelId
  }

  const candidate = MODEL_MAP[normalized as ModelKey]
  if (candidate) {
    return candidate.id
  }

  if (process.env.NODE_ENV !== 'test') {
    console.warn(`[Model Config] Unknown model "${key}", falling back to grok-4-fast`)
  }
  return MODEL_MAP['grok-4-fast'].id
}
