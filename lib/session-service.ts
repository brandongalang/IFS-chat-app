import type { SupabaseClient } from '@supabase/supabase-js'
import {
  completeSessionRecord,
  createSessionRecord,
  getSessionRecord,
  listSessionRecords,
  touchSession,
} from './data/schema/server'
import type { SessionRowV2 } from './data/schema'
import { enqueueMemoryUpdate } from './memory/queue'
import { getStorageAdapter, sessionTranscriptPath } from './memory/snapshots/fs-helpers'
import type { Database, SessionMessage, SessionRow, SessionUpdate } from './types/database'
import { getServiceClient } from '@/lib/supabase/clients'

interface StoredTranscript {
  id?: string
  user_id?: string | null
  start_time?: string
  end_time?: string | null
  duration?: number | null
  messages?: SessionMessage[]
}

export interface ChatSessionServiceOptions {
  supabase: SupabaseClient<Database>
  userId: string
}

export class ChatSessionService {
  private readonly supabase: SupabaseClient<Database>
  private readonly userId: string
  private userRecordEnsured = false

  constructor(options: ChatSessionServiceOptions) {
    this.userId = options.userId
    this.supabase = options.supabase
  }

  /**
   * Dual-write session to both PRD (sessions_v2) and legacy (sessions) tables
   * during migration period. Legacy table is still read by cron jobs and memory service.
   */
  private async syncLegacySessionWrite(
    sessionId: string,
    prdSession: SessionRowV2,
    transcript?: StoredTranscript
  ): Promise<void> {
    try {
      const legacyPayload = {
        id: sessionId,
        user_id: prdSession.user_id,
        start_time: prdSession.started_at,
        end_time: prdSession.ended_at,
        duration: prdSession.ended_at
          ? Math.floor(
              (new Date(prdSession.ended_at).getTime() - new Date(prdSession.started_at).getTime()) / 1000
            )
          : null,
        messages: transcript?.messages ?? [],
        processed: false,
        processed_at: null,
        created_at: prdSession.created_at,
        updated_at: prdSession.updated_at,
      }

      await this.supabase.from('sessions').upsert(legacyPayload, { onConflict: 'id' })
    } catch (error) {
      console.warn('[sessions] failed to sync to legacy sessions table', {
        sessionId,
        error,
      })
    }
  }

  /**
   * Start a new chat session for the current user
   */
  async startSession(): Promise<string> {
    await this.ensureUserRecord()

    const startedAt = new Date().toISOString()

    const session = await createSessionRecord(
      {
        type: 'therapy',
        metadata: {},
        started_at: startedAt,
      },
      {
        client: this.supabase,
        userId: this.userId,
      },
    )

    const transcript = {
      user_id: session.user_id,
      start_time: session.started_at,
      end_time: null,
      duration: null,
      messages: [] as SessionMessage[],
    }

    // Best-effort: writing transcript requires Supabase Storage service role.
    // If missing/misconfigured in certain deploys, do not fail session start.
    try {
      await this.writeTranscript(session.id, transcript)
    } catch (error) {
      console.warn('[sessions] writeTranscript failed at startSession; continuing without storage', {
        sessionId: session.id,
        error,
      })
    }

    // TODO(ifs-chat-app-5): Remove dual-write once all readers migrated to PRD sessions_v2
    await this.syncLegacySessionWrite(session.id, session)

    // TODO(ifs-chat-app-5): Reintroduce action logging once PRD event hooks are defined.

    return session.id
  }

  private async ensureUserRecord(): Promise<void> {
    if (this.userRecordEnsured) {
      return
    }

    // First try with user-scoped client (RLS expected)
    const { data: existing, error: selectError } = await this.supabase
      .from('users')
      .select('id')
      .eq('id', this.userId)
      .maybeSingle()

    // If RLS or other errors prevent reading, try service-role fallback
    let exists = Boolean(existing?.id)
    if (!exists && selectError && selectError.code !== 'PGRST116') {
      try {
        const admin = getServiceClient()
        const { data: adminExisting } = await admin
          .from('users')
          .select('id')
          .eq('id', this.userId)
          .maybeSingle()
        exists = Boolean(adminExisting?.id)
      } catch (e) {
        // ignore; we'll attempt upsert below
        console.warn('[sessions] admin fallback select failed in ensureUserRecord', e)
      }
    }

    if (exists) {
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

    // Prefer service-role for upsert to bypass missing RLS policies
    let upsertError: unknown = null
    try {
      const admin = getServiceClient()
      const { error } = await admin
        .from('users')
        .upsert(
          {
            id: this.userId,
            email: profile.email,
            name: nameMetadata,
          },
          { onConflict: 'id' },
        )
      upsertError = error ?? null
    } catch (e) {
      upsertError = e
    }

    if (upsertError) {
      const msg = upsertError && typeof upsertError === 'object' && 'message' in upsertError
        ? String((upsertError as { message?: string }).message)
        : 'unknown error'
      throw new Error(`Failed to upsert user profile: ${msg}`)
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
    const newMessage: SessionMessage = {
      ...message,
      timestamp: new Date().toISOString(),
    }
    const existingTranscript = await this.readTranscript(sessionId)
    const updatedMessages = [...(existingTranscript?.messages ?? []), newMessage]

    let session: SessionRowV2
    try {
      session = await touchSession(
        sessionId,
        { last_message_at: newMessage.timestamp },
        { client: this.supabase, userId: this.userId },
      )
    } catch (error) {
      const err = error as { message?: string }
      throw new Error(`Failed to record session activity: ${err.message ?? 'unknown error'}`)
    }

    const transcript = {
      user_id: session.user_id,
      start_time: session.started_at,
      end_time: session.ended_at,
      messages: updatedMessages,
    }

    try {
      await this.writeTranscript(sessionId, transcript, existingTranscript)
    } catch (error) {
      console.warn('[sessions] writeTranscript failed at addMessage; message persisted in DB only', {
        sessionId,
        error,
      })
    }

    // TODO(ifs-chat-app-5): Remove dual-write once all readers migrated to PRD sessions_v2
    await this.syncLegacySessionWrite(sessionId, session, transcript)
  }

  /**
   * End a session and calculate duration
   */
  async endSession(sessionId: string): Promise<void> {
    const endTime = new Date().toISOString()

    const existingTranscript = await this.readTranscript(sessionId)

    let session: SessionRowV2
    try {
      session = await completeSessionRecord(
        sessionId,
        { ended_at: endTime },
        { client: this.supabase, userId: this.userId },
      )
    } catch (error) {
      const err = error as { message?: string }
      throw new Error(`Failed to complete session: ${err.message ?? 'unknown error'}`)
    }

    const startedAt = session.started_at ?? existingTranscript?.start_time
    const duration =
      startedAt != null
        ? Math.floor((new Date(endTime).getTime() - new Date(startedAt).getTime()) / 1000)
        : null

    const transcript = {
      user_id: session.user_id,
      start_time: startedAt ?? endTime,
      end_time: session.ended_at,
      duration,
      messages: existingTranscript?.messages,
    }

    try {
      await this.writeTranscript(sessionId, transcript, existingTranscript)
    } catch (error) {
      console.warn('[sessions] writeTranscript failed at endSession; continuing', {
        sessionId,
        error,
      })
    }

    // TODO(ifs-chat-app-5): Remove dual-write once all readers migrated to PRD sessions_v2
    await this.syncLegacySessionWrite(sessionId, session, transcript)

    const enqueueResult = await enqueueMemoryUpdate({
      userId: session.user_id,
      kind: 'session',
      refId: sessionId,
      payload: {
        sessionId,
        endedAt: endTime,
        duration,
      },
      metadata: { source: 'session_service' },
    })
    if (!enqueueResult.inserted && enqueueResult.error) {
      console.warn('[sessions] failed to enqueue memory update', {
        userId: session.user_id,
        sessionId,
        error: enqueueResult.error,
      })
    }
  }

  /**
   * Map a PRD SessionRowV2 to legacy SessionRow format
   */
  private mapPrdSessionToLegacy(prdSession: SessionRowV2): Partial<SessionRow> {
    const duration =
      prdSession.started_at && prdSession.ended_at
        ? Math.floor(
            (new Date(prdSession.ended_at).getTime() - new Date(prdSession.started_at).getTime()) / 1000
          )
        : null

    return {
      id: prdSession.id,
      user_id: prdSession.user_id,
      start_time: prdSession.started_at,
      end_time: prdSession.ended_at,
      duration,
      messages: [],
      summary: prdSession.summary,
      new_parts: [],
      breakthroughs: prdSession.breakthroughs,
      parts_involved: {},
      emotional_arc: {
        start: { valence: 0, arousal: 0 },
        peak: { valence: 0, arousal: 0 },
        end: { valence: 0, arousal: 0 },
      },
      processed: false,
      processed_at: null,
      created_at: prdSession.created_at,
      updated_at: prdSession.updated_at,
    }
  }

  /**
   * Get session history with messages
   */
  async getSession(sessionId: string): Promise<SessionRow | null> {
    try {
      const prdSession = await getSessionRecord(sessionId, {
        client: this.supabase,
        userId: this.userId,
      })

      if (!prdSession) {
        return null
      }

      const transcript = await this.readTranscript(sessionId)

      const legacy = this.mapPrdSessionToLegacy(prdSession)
      return {
        ...legacy,
        messages: transcript?.messages ?? [],
      } as SessionRow
    } catch (error) {
      const err = error as { message?: string }
      throw new Error(`Failed to load session ${sessionId}: ${err.message ?? 'unknown error'}`)
    }
  }

  /**
   * Get recent sessions for the current user
   */
  async getUserSessions(limit: number = 10): Promise<SessionRow[]> {
    try {
      const prdSessions = await listSessionRecords(
        {
          client: this.supabase,
          userId: this.userId,
        },
        limit
      )

      return prdSessions.map((s) => this.mapPrdSessionToLegacy(s)) as SessionRow[]
    } catch (error) {
      const err = error as { message?: string }
      throw new Error(`Failed to list sessions: ${err.message ?? 'unknown error'}`)
    }
  }

  /**
   * Get messages from a session (lightweight - just messages)
   */
  async getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
    try {
      const transcript = await this.readTranscript(sessionId)
      return transcript?.messages ?? []
    } catch (error) {
      const err = error as { message?: string }
      throw new Error(`Failed to load session messages for ${sessionId}: ${err.message ?? 'unknown error'}`)
    }
  }

  /**
   * Update session metadata (for IFS-specific tracking)
   */
  async updateSessionMetadata(sessionId: string, updates: Partial<SessionUpdate>): Promise<void> {
    try {
      const patchUpdates: { last_message_at?: string; observations?: string[] } = {}

      // Map legacy SessionUpdate fields to PRD session metadata
      if (updates.updated_at) {
        patchUpdates.last_message_at = updates.updated_at
      }

      if (Object.keys(patchUpdates).length === 0) {
        return
      }

      await touchSession(
        sessionId,
        patchUpdates,
        {
          client: this.supabase,
          userId: this.userId,
        }
      )
    } catch (error) {
      const err = error as { message?: string }
      throw new Error(`Failed to update session metadata for ${sessionId}: ${err.message ?? 'unknown error'}`)
    }
  }

  private async readTranscript(sessionId: string, userId?: string): Promise<StoredTranscript | undefined> {
    const storage = await getStorageAdapter()
    const transcriptUserId = userId ?? this.userId
    const transcriptPath = sessionTranscriptPath(transcriptUserId, sessionId)

    try {
      const existing = await storage.getText(transcriptPath)
      if (!existing) {
        return undefined
      }
      const parsed = JSON.parse(existing) as StoredTranscript
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    } catch {
      return undefined
    }

    return undefined
  }

  private async writeTranscript(
    sessionId: string,
    session: {
      user_id?: string | null
      start_time: string
      end_time?: string | null
      duration?: number | null
      messages?: SessionMessage[] | null
    },
    existing?: StoredTranscript,
  ): Promise<void> {
    const storage = await getStorageAdapter()
    const transcriptUserId = session.user_id ?? this.userId
    const transcriptPath = sessionTranscriptPath(transcriptUserId, sessionId)

    const parsed = existing ?? (await this.readTranscript(sessionId, transcriptUserId))

    const storedMessages = parsed?.messages
    const parsedMessages = Array.isArray(storedMessages)
      ? (storedMessages as SessionMessage[])
      : undefined

    const transcript = {
      id: sessionId,
      user_id: transcriptUserId,
      start_time: typeof parsed?.start_time === 'string' ? parsed.start_time : session.start_time,
      end_time:
        session.end_time !== undefined
          ? session.end_time ?? null
          : parsed?.end_time ?? null,
      duration:
        session.duration !== undefined
          ? session.duration ?? null
          : typeof parsed?.duration === 'number'
          ? parsed.duration
          : null,
      messages: Array.isArray(session.messages)
        ? (session.messages as SessionMessage[])
        : parsedMessages ?? [],
    }

    await storage.putText(transcriptPath, JSON.stringify(transcript), {
      contentType: 'application/json',
    })
  }
}

export function createChatSessionService(options: ChatSessionServiceOptions): ChatSessionService {
  return new ChatSessionService(options)
}
