import type { SupabaseClient } from '@supabase/supabase-js'
import { DatabaseActionLogger } from './database/action-logger'
import type {
  Database,
  SessionInsert,
  SessionMessage,
  SessionRow,
  SessionUpdate,
} from './types/database'
import { getStorageAdapter, sessionTranscriptPath } from './memory/snapshots/fs-helpers'

export interface ChatSessionServiceOptions {
  supabase: SupabaseClient<Database>
  userId: string
}

export class ChatSessionService {
  private readonly supabase: SupabaseClient<Database>
  private readonly actionLogger: DatabaseActionLogger
  private readonly userId: string
  private userRecordEnsured = false

  constructor(options: ChatSessionServiceOptions) {
    this.userId = options.userId
    this.supabase = options.supabase

    this.actionLogger = new DatabaseActionLogger(this.supabase)
  }

  /**
   * Start a new chat session for the current user
   */
  async startSession(): Promise<string> {
    await this.ensureUserRecord()

    const session: SessionInsert = {
      user_id: this.userId,
      start_time: new Date().toISOString(),
      messages: [],
      parts_involved: {},
      new_parts: [],
      breakthroughs: [],
      emotional_arc: {
        start: { valence: 0, arousal: 0 },
        peak: { valence: 0, arousal: 0 },
        end: { valence: 0, arousal: 0 },
      },
      processed: false,
    }

    const data = await this.actionLogger.loggedInsert<{ id: string }>(
      'sessions',
      session,
      this.userId,
      'create_session',
      {
        changeDescription: 'Started new chat session',
        sessionId: undefined,
      },
    )

    const storage = await getStorageAdapter()
    const transcriptPath = sessionTranscriptPath(this.userId, data.id)
    const transcript = {
      id: data.id,
      user_id: this.userId,
      start_time: session.start_time,
      end_time: null as string | null,
      duration: null as number | null,
      messages: [] as SessionMessage[],
    }
    await storage.putText(transcriptPath, JSON.stringify(transcript), {
      contentType: 'application/json',
    })

    return data.id
  }

  private async ensureUserRecord(): Promise<void> {
    if (this.userRecordEnsured) {
      return
    }

    const {
      data: existing,
      error: selectError,
    } = await this.supabase
      .from('users')
      .select('id')
      .eq('id', this.userId)
      .maybeSingle()

    if (selectError && selectError.code !== 'PGRST116') {
      throw new Error(`Failed to verify user record: ${selectError.message}`)
    }

    if (existing?.id) {
      this.userRecordEnsured = true
      return
    }

    const profile = await this.fetchProfileDetails()

    if (!profile?.email) {
      throw new Error('Authenticated Supabase user is missing an email; cannot ensure profile record')
    }

    const nameMetadata =
      (profile.user_metadata?.full_name as string | undefined) ||
      (profile.user_metadata?.name as string | undefined) ||
      profile.email

    const { error: upsertError } = await this.supabase
      .from('users')
      .upsert(
        {
          id: this.userId,
          email: profile.email,
          name: nameMetadata,
        },
        { onConflict: 'id' },
      )

    if (upsertError) {
      throw new Error(`Failed to upsert user profile: ${upsertError.message}`)
    }

    console.info('ChatSessionService: created missing user profile', { userId: this.userId })

    this.userRecordEnsured = true
  }

  private async fetchProfileDetails(): Promise<{
    email: string | null
    user_metadata?: Record<string, unknown>
  } | null> {
    const { data, error } = await this.supabase.auth.getUser()
    if (!error && data?.user) {
      return {
        email: data.user.email ?? null,
        user_metadata: data.user.user_metadata as Record<string, unknown> | undefined,
      }
    }

    if (this.supabase.auth?.admin) {
      const { data, error } = await this.supabase.auth.admin.getUserById(this.userId)
      if (error) {
        throw new Error(`Failed to fetch admin user profile: ${error.message}`)
      }
      if (!data?.user) {
        return null
      }
      return {
        email: data.user.email ?? null,
        user_metadata: data.user.user_metadata as Record<string, unknown> | undefined,
      }
    }

    throw new Error('Unable to resolve Supabase user profile for session operations')
  }

  /**
   * Add a message to an existing session
   */
  async addMessage(
    sessionId: string,
    message: Omit<SessionMessage, 'timestamp'>,
  ): Promise<void> {
    const { data: session, error: fetchError } = await this.supabase
      .from('sessions')
      .select('messages, user_id, start_time, end_time, duration')
      .eq('id', sessionId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch session: ${fetchError.message}`)
    }

    const newMessage: SessionMessage = {
      ...message,
      timestamp: new Date().toISOString(),
    }
    const updatedMessages = [...(session.messages || []), newMessage]

    const { error: updateError } = await this.supabase
      .from('sessions')
      .update({
        messages: updatedMessages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (updateError) {
      throw new Error(`Failed to add message: ${updateError.message}`)
    }

    const storage = await getStorageAdapter()
    const transcriptUserId = session.user_id || this.userId
    const transcriptPath = sessionTranscriptPath(transcriptUserId, sessionId)
    let transcript
    try {
      const existing = await storage.getText(transcriptPath)
      transcript = existing
        ? JSON.parse(existing)
        : {
            id: sessionId,
            user_id: transcriptUserId,
            start_time: session.start_time,
            end_time: session.end_time,
            duration: session.duration,
            messages: [] as SessionMessage[],
          }
    } catch {
      transcript = {
        id: sessionId,
        user_id: transcriptUserId,
        start_time: session.start_time,
        end_time: session.end_time,
        duration: session.duration,
        messages: [] as SessionMessage[],
      }
    }

    transcript.messages = updatedMessages
    await storage.putText(transcriptPath, JSON.stringify(transcript), {
      contentType: 'application/json',
    })
  }

  /**
   * End a session and calculate duration
   */
  async endSession(sessionId: string): Promise<void> {
    const endTime = new Date().toISOString()

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
        duration,
        updated_at: endTime,
      })
      .eq('id', sessionId)

    if (error) {
      throw new Error(`Failed to end session: ${error.message}`)
    }

    const storage = await getStorageAdapter()
    const transcriptUserId = session.user_id || this.userId
    const transcriptPath = sessionTranscriptPath(transcriptUserId, sessionId)
    let transcript
    try {
      const existing = await storage.getText(transcriptPath)
      transcript = existing
        ? JSON.parse(existing)
        : {
            id: sessionId,
            user_id: transcriptUserId,
            start_time: session.start_time,
            end_time: null as string | null,
            duration: null as number | null,
            messages: session.messages || [],
          }
    } catch {
      transcript = {
        id: sessionId,
        user_id: transcriptUserId,
        start_time: session.start_time,
        end_time: null as string | null,
        duration: null as number | null,
        messages: session.messages || [],
      }
    }

    transcript.end_time = endTime
    transcript.duration = duration
    await storage.putText(transcriptPath, JSON.stringify(transcript), {
      contentType: 'application/json',
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
      if ((error as { code?: string }).code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to get session: ${error.message}`)
    }

    return data
  }

  /**
   * Get recent sessions for the current user
   */
  async getUserSessions(limit: number = 10): Promise<SessionRow[]> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('user_id', this.userId)
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
      if ((error as { code?: string }).code === 'PGRST116') {
        return []
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (error) {
      throw new Error(`Failed to update session metadata: ${error.message}`)
    }
  }

  private resolveUserId(userId?: string): string {
    if (userId) return userId
    if (this.userId) return this.userId
    throw new Error('User ID is required to perform session operations')
  }
}

export function createChatSessionService(options: ChatSessionServiceOptions): ChatSessionService {
  return new ChatSessionService(options)
}
