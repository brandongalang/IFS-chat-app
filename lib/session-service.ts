import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from './supabase/client'
import {
  actionLogger as defaultActionLogger,
  createActionLogger,
  type ActionLogger,
} from './database/action-logger'
import type { SessionMessage, SessionRow, SessionInsert, SessionUpdate, Database } from './types/database'
import { getStorageAdapter, sessionTranscriptPath } from './memory/snapshots/fs-helpers'

export interface ChatSessionServiceOptions {
  supabaseClient?: SupabaseClient<Database>
  actionLogger?: ActionLogger
  defaultUserId?: string
}

export class ChatSessionService {
  private supabase: SupabaseClient<Database>
  private actionLogger: ActionLogger
  private defaultUserId?: string

  constructor(options: ChatSessionServiceOptions = {}) {
    this.supabase = options.supabaseClient ?? createClient()
    this.actionLogger = options.actionLogger ?? defaultActionLogger
    this.defaultUserId = options.defaultUserId
  }

  /**
   * Start a new chat session
   */
  async startSession(userId?: string): Promise<string> {
    const resolvedUserId = this.resolveUserId(userId)
    const session: SessionInsert = {
      user_id: resolvedUserId,
      start_time: new Date().toISOString(),
      messages: [],
      parts_involved: {},
      new_parts: [],
      breakthroughs: [],
      emotional_arc: {
        start: { valence: 0, arousal: 0 },
        peak: { valence: 0, arousal: 0 },
        end: { valence: 0, arousal: 0 }
      },
      processed: false
    }

    // Use action logger for session creation
    const data = await this.actionLogger.loggedInsert<{ id: string }>(
      'sessions',
      session,
      resolvedUserId,
      'create_session',
      {
        changeDescription: 'Started new chat session',
        sessionId: undefined // Will be set after creation
      }
    )
    const storage = await getStorageAdapter()
    const transcriptPath = sessionTranscriptPath(resolvedUserId, data.id)
    const transcript = {
      id: data.id,
      user_id: resolvedUserId,
      start_time: session.start_time,
      end_time: null as string | null,
      duration: null as number | null,
      messages: [] as SessionMessage[]
    }
    await storage.putText(transcriptPath, JSON.stringify(transcript), {
      contentType: 'application/json'
    })

    return data.id
  }

  /**
   * Add a message to an existing session
   */
  async addMessage(
    sessionId: string,
    message: Omit<SessionMessage, 'timestamp'>
  ): Promise<void> {
    // First get the current session
    const { data: session, error: fetchError } = await this.supabase
      .from('sessions')
      .select('messages, user_id, start_time, end_time, duration')
      .eq('id', sessionId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch session: ${fetchError.message}`)
    }

    // Add the new message with timestamp
    const newMessage: SessionMessage = {
      ...message,
      timestamp: new Date().toISOString()
    }

    const updatedMessages = [...(session.messages || []), newMessage]

    // Update the session with new messages
    const { error: updateError } = await this.supabase
      .from('sessions')
      .update({ 
        messages: updatedMessages,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateError) {
      throw new Error(`Failed to add message: ${updateError.message}`)
    }

    const storage = await getStorageAdapter()
    const transcriptPath = sessionTranscriptPath(session.user_id, sessionId)
    let transcript
    try {
      const existing = await storage.getText(transcriptPath)
      transcript = existing ? JSON.parse(existing) : {
        id: sessionId,
        user_id: session.user_id,
        start_time: session.start_time,
        end_time: session.end_time,
        duration: session.duration,
        messages: [] as SessionMessage[]
      }
    } catch {
      transcript = {
        id: sessionId,
        user_id: session.user_id,
        start_time: session.start_time,
        end_time: session.end_time,
        duration: session.duration,
        messages: [] as SessionMessage[]
      }
    }
    transcript.messages = updatedMessages
    await storage.putText(transcriptPath, JSON.stringify(transcript), {
      contentType: 'application/json'
    })
  }

  /**
   * End a session and calculate duration
   */
  async endSession(sessionId: string): Promise<void> {
    const endTime = new Date().toISOString()
    
    // Get session start time to calculate duration
    const { data: session, error: fetchError } = await this.supabase
      .from('sessions')
      .select('start_time, user_id, end_time, duration, messages')
      .eq('id', sessionId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch session: ${fetchError.message}`)
    }

    const startTime = new Date(session.start_time)
    const duration = Math.floor((new Date(endTime).getTime() - startTime.getTime()) / 1000)

    const { error } = await this.supabase
      .from('sessions')
      .update({
        end_time: endTime,
        duration: duration,
        updated_at: endTime
      })
      .eq('id', sessionId)

    if (error) {
      throw new Error(`Failed to end session: ${error.message}`)
    }

    const storage = await getStorageAdapter()
    const transcriptPath = sessionTranscriptPath(session.user_id, sessionId)
    let transcript
    try {
      const existing = await storage.getText(transcriptPath)
      transcript = existing ? JSON.parse(existing) : {
        id: sessionId,
        user_id: session.user_id,
        start_time: session.start_time,
        end_time: null as string | null,
        duration: null as number | null,
        messages: session.messages || []
      }
    } catch {
      transcript = {
        id: sessionId,
        user_id: session.user_id,
        start_time: session.start_time,
        end_time: null as string | null,
        duration: null as number | null,
        messages: session.messages || []
      }
    }
    transcript.end_time = endTime
    transcript.duration = duration
    await storage.putText(transcriptPath, JSON.stringify(transcript), {
      contentType: 'application/json'
    })
  }

  /**
   * Get session history with messages
   */
  async getSession(sessionId: string): Promise<SessionRow | null> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Session not found
      }
      throw new Error(`Failed to get session: ${error.message}`)
    }

    return data
  }

  /**
   * Get recent sessions for a user
   */
  async getUserSessions(userId: string, limit: number = 10): Promise<SessionRow[]> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to get user sessions: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get messages from a session (lightweight - just messages)
   */
  async getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('messages')
      .eq('id', sessionId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return [] // Session not found
      }
      throw new Error(`Failed to get session messages: ${error.message}`)
    }

    return data.messages || []
  }

  /**
   * Update session metadata (for IFS-specific tracking)
   */
  async updateSessionMetadata(sessionId: string, updates: Partial<SessionUpdate>): Promise<void> {
    const { error } = await this.supabase
      .from('sessions')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (error) {
      throw new Error(`Failed to update session metadata: ${error.message}`)
    }
  }

  private resolveUserId(userId?: string): string {
    if (userId) return userId
    if (this.defaultUserId) return this.defaultUserId
    throw new Error('User ID is required to perform session operations')
  }
}

// Export singleton instance
export const chatSessionService = new ChatSessionService()

export function createChatSessionService(options: ChatSessionServiceOptions = {}): ChatSessionService {
  const { supabaseClient, actionLogger, defaultUserId } = options
  const logger = actionLogger ?? (supabaseClient ? createActionLogger(supabaseClient) : undefined)
  return new ChatSessionService({
    supabaseClient,
    actionLogger: logger,
    defaultUserId,
  })
}
