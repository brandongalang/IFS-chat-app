import { createTool } from '@mastra/core'
import { z } from 'zod'

import { resolveUserId } from '@/config/dev'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import { getServiceClient } from '@/lib/supabase/clients'
import { readOverviewSections, readPartProfileSections } from '@/lib/memory/read'

const searchQuerySchema = z
  .object({
    userId: z.string().uuid().optional().describe('Target user ID; defaults to the active profile.'),
    query: z.string().min(2).max(200).describe('Case-insensitive search query.'),
    limit: z.number().int().min(1).max(20).default(5).describe('Maximum number of matches to return.'),
  })
  .strict()

const timelineSearchSchema = searchQuerySchema
  .extend({
    lookbackDays: z.number().int().min(1).max(60).default(14).describe('Number of days to look back when querying.'),
  })
  .strict()

let cachedClient: SupabaseDatabaseClient | null = null

function resolveServiceClient(): SupabaseDatabaseClient {
  if (!cachedClient) {
    cachedClient = getServiceClient()
  }
  return cachedClient
}

export const searchMarkdownTool = createTool({
  id: 'searchMarkdown',
  description: 'Searches user overview and part markdown files for passages matching the query.',
  inputSchema: searchQuerySchema,
  execute: async ({ context }) => {
    const input = searchQuerySchema.parse(context)
    const userId = resolveUserId(input.userId)
    const supabase = resolveServiceClient()

    const query = input.query.trim().toLowerCase()
    const matches: Array<Record<string, unknown>> = []

    const overviewSections = await readOverviewSections(userId)
    if (overviewSections) {
      for (const [anchor, section] of Object.entries(overviewSections)) {
        const snippet = extractSnippet(section.text, query)
        if (snippet) {
          matches.push({
            source: 'overview',
            anchor,
            heading: section.heading,
            snippet,
          })
        }
      }
    }

    if (matches.length < input.limit) {
      const { data: parts, error } = await supabase
        .from('parts')
        .select('id,name,updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(40)

      if (error) throw error

      for (const part of parts ?? []) {
        const sections = await readPartProfileSections(userId, part.id)
        if (!sections) continue

        for (const [anchor, section] of Object.entries(sections)) {
          const snippet = extractSnippet(section.text, query)
          if (snippet) {
            matches.push({
              source: 'part',
              partId: part.id,
              partName: part.name,
              anchor,
              heading: section.heading,
              snippet,
            })
          }
        }

        if (matches.length >= input.limit) break
      }
    }

    return {
      userId,
      query: input.query,
      matches: matches.slice(0, input.limit),
    }
  },
})

export const searchSessionsTool = createTool({
  id: 'searchSessions',
  description: 'Searches session summaries and transcripts for passages matching the query.',
  inputSchema: timelineSearchSchema,
  execute: async ({ context }) => {
    const input = timelineSearchSchema.parse(context)
    const userId = resolveUserId(input.userId)
    const supabase = resolveServiceClient()

    const lookback = new Date()
    lookback.setDate(lookback.getDate() - input.lookbackDays)

    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('id,start_time,summary,messages')
      .eq('user_id', userId)
      .gte('start_time', lookback.toISOString())
      .order('start_time', { ascending: false })
      .limit(40)

    if (error) throw error

    const query = input.query.trim().toLowerCase()
    const matches: Array<Record<string, unknown>> = []

    for (const session of sessions ?? []) {
      const summarySnippet = extractSnippet(session.summary ?? '', query)
      if (summarySnippet) {
        matches.push({
          sessionId: session.id,
          matchedField: 'summary',
          snippet: summarySnippet,
          occurredAt: session.start_time,
        })
      }

      const messages = Array.isArray(session.messages) ? session.messages : []
      for (const message of messages) {
        if (!message || typeof message.content !== 'string') continue
        const snippet = extractSnippet(message.content, query)
        if (snippet) {
          matches.push({
            sessionId: session.id,
            matchedField: message.role ?? 'message',
            snippet,
            occurredAt: session.start_time,
          })
        }
        if (matches.length >= input.limit) break
      }

      if (matches.length >= input.limit) break
    }

    return {
      userId,
      query: input.query,
      matches: matches.slice(0, input.limit),
    }
  },
})

export const searchCheckInsTool = createTool({
  id: 'searchCheckIns',
  description: 'Searches check-in entries for reflections that match the query.',
  inputSchema: timelineSearchSchema,
  execute: async ({ context }) => {
    const input = timelineSearchSchema.parse(context)
    const userId = resolveUserId(input.userId)
    const supabase = resolveServiceClient()

    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - input.lookbackDays)

    const { data: checkIns, error } = await supabase
      .from('check_ins')
      .select('id,type,check_in_date,intention,reflection,gratitude,parts_data,created_at')
      .eq('user_id', userId)
      .gte('check_in_date', sinceDate.toISOString().slice(0, 10))
      .order('check_in_date', { ascending: false })
      .limit(60)

    if (error) throw error

    const query = input.query.trim().toLowerCase()
    const matches: Array<Record<string, unknown>> = []

    for (const entry of checkIns ?? []) {
      const fields = [entry.intention, entry.reflection, entry.gratitude, stringify(entry.parts_data)]
      for (const field of fields) {
        const snippet = extractSnippet(field ?? '', query)
        if (snippet) {
          matches.push({
            checkInId: entry.id,
            type: entry.type,
            date: entry.check_in_date,
            snippet,
          })
          break
        }
      }
      if (matches.length >= input.limit) break
    }

    return {
      userId,
      query: input.query,
      matches: matches.slice(0, input.limit),
    }
  },
})

function extractSnippet(text: string, query: string): string | null {
  if (!text) return null

  const normalized = text.toLowerCase()
  const index = normalized.indexOf(query)
  if (index === -1) return null

  const window = 80
  const start = Math.max(0, index - window)
  const end = Math.min(text.length, index + query.length + window)
  const snippet = text.slice(start, end).trim()
  return snippet.length ? snippet : text.slice(0, Math.min(text.length, 160)).trim()
}

function stringify(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const observationResearchTools = {
  searchMarkdown: searchMarkdownTool,
  searchSessions: searchSessionsTool,
  searchCheckIns: searchCheckInsTool,
}

export type ObservationResearchTools = typeof observationResearchTools
