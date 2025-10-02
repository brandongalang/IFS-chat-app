export type MarkdownListGlob = string

export interface MarkdownListParams {
  userId: string
  prefix?: string
  glob?: MarkdownListGlob | MarkdownListGlob[]
  limit?: number
}

export interface MarkdownListItem {
  path: string
  size: number
  updatedAt: string
}

export interface MarkdownSearchParams {
  userId: string
  pattern: string
  prefix?: string
  glob?: MarkdownListGlob | MarkdownListGlob[]
  regex?: boolean
  flags?: string
  ignoreCase?: boolean
  maxMatches?: number
  timeoutMs?: number
  contextBefore?: number
  contextAfter?: number
}

export interface MarkdownSearchMatch {
  path: string
  line: number
  snippet: string
  before: string[]
  after: string[]
}

export interface MarkdownSearchResult {
  matches: MarkdownSearchMatch[]
  truncated: boolean
  runtimeMs: number
}

export interface MarkdownReadParams {
  userId: string
  path: string
  offset?: number
  limit?: number
}

export interface MarkdownReadChunk {
  path: string
  offset: number
  nextOffset: number | null
  data: string
  hasMore: boolean
}

export type SessionSearchField = 'summary' | 'messages'

export interface SessionSearchParams {
  userId: string
  query: string
  lookbackDays?: number
  fields?: SessionSearchField[]
  limit?: number
}

export interface SessionSearchMatch {
  sessionId: string
  field: SessionSearchField | string
  snippet: string
  occurredAt: string
  score: number | null
}

export interface SessionSearchResult {
  matches: SessionSearchMatch[]
  truncated: boolean
  runtimeMs: number
}

export interface SessionListParams {
  userId: string
  lookbackDays?: number
  limit?: number
}

export interface SessionListItem {
  sessionId: string
  startedAt: string
  endedAt: string | null
  summary: string | null
}

export interface SessionListResult {
  items: SessionListItem[]
  truncated: boolean
  runtimeMs: number
}

export interface SessionDetailParams {
  userId: string
  sessionId: string
  page?: number
  pageSize?: number
}

export interface SessionDetail {
  sessionId: string
  startedAt: string
  endedAt: string | null
  summary: string | null
  messages: Array<{ role: string; content: string; timestamp?: string }>
  nextPage: number | null
}

export interface CheckInSearchParams {
  userId: string
  query: string
  lookbackDays?: number
  limit?: number
}

export interface CheckInSearchMatch {
  checkInId: string
  type: 'morning' | 'evening' | string
  date: string
  snippet: string
  score: number | null
}

export interface CheckInSearchResult {
  matches: CheckInSearchMatch[]
  truncated: boolean
  runtimeMs: number
}

export interface CheckInListParams {
  userId: string
  lookbackDays?: number
  limit?: number
}

export interface CheckInListItem {
  checkInId: string
  type: 'morning' | 'evening' | string
  date: string
  intention: string | null
  reflection: string | null
}

export interface CheckInListResult {
  items: CheckInListItem[]
  truncated: boolean
  runtimeMs: number
}

export interface CheckInDetailParams {
  userId: string
  checkInId: string
}

export interface CheckInDetail {
  checkInId: string
  type: 'morning' | 'evening' | string
  date: string
  intention: string | null
  reflection: string | null
  gratitude: string | null
  partsData: unknown
  createdAt: string
  updatedAt: string
}

export interface ObservationTelemetryEvent {
  tool: 'md.list' | 'md.search' | 'md.read' | 'sessions.search' | 'sessions.get' | 'sessions.list' | 'checkins.search' | 'checkins.get' | 'checkins.list'
  userId: string
  durationMs: number
  metadata?: Record<string, unknown>
  error?: string
}

export interface ObservationTelemetryClient {
  record(event: ObservationTelemetryEvent): Promise<void>
}
