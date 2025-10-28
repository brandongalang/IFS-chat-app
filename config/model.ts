import { ENV } from '@/config/env'

export type ModelId = string

export function resolveChatModel(): ModelId {
  return ENV.IFS_CHAT_MODEL.trim() || 'google/gemini-2.5-flash-lite-preview-09-2025'
}

export function resolveAgentModel(): ModelId {
  return ENV.IFS_AGENT_MODEL.trim() || 'google/gemini-2.5-flash-lite-preview-09-2025'
}
