// Database Types for IFS Therapy Companion
// Generated from Supabase schema

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow
        Insert: UserInsert
        Update: UserUpdate
        Relationships: []
      }
      parts: {
        Row: PartRow
        Insert: PartInsert
        Update: PartUpdate
        Relationships: [
          {
            foreignKeyName: "parts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      sessions: {
        Row: SessionRow
        Insert: SessionInsert
        Update: SessionUpdate
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      part_relationships: {
        Row: PartRelationshipRow
        Insert: PartRelationshipInsert
        Update: PartRelationshipUpdate
        Relationships: [
          {
            foreignKeyName: "part_relationships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      part_assessments: {
        Row: PartAssessmentRow
        Insert: PartAssessmentInsert
        Update: PartAssessmentUpdate
        Relationships: [
          {
            foreignKeyName: "part_assessments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_assessments_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          }
        ]
      }
      part_change_proposals: {
        Row: PartChangeProposalRow
        Insert: PartChangeProposalInsert
        Update: PartChangeProposalUpdate
        Relationships: [
          {
            foreignKeyName: "part_change_proposals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      part_notes: {
        Row: PartNoteRow
        Insert: PartNoteInsert
        Update: PartNoteUpdate
        Relationships: [
          {
            foreignKeyName: "part_notes_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          }
        ]
      }
      insights: {
        Row: InsightRow
        Insert: InsightInsert
        Update: InsightUpdate
        Relationships: [
          {
            foreignKeyName: "insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      inbox_observations: {
        Row: InboxObservationRow
        Insert: InboxObservationInsert
        Update: InboxObservationUpdate
        Relationships: [
          {
            foreignKeyName: "inbox_observations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      observation_events: {
        Row: ObservationEventRow
        Insert: ObservationEventInsert
        Update: ObservationEventUpdate
        Relationships: [
          {
            foreignKeyName: "observation_events_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "inbox_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      inbox_job_runs: {
        Row: InboxJobRunRow
        Insert: InboxJobRunInsert
        Update: InboxJobRunUpdate
        Relationships: []
      }
    }
    Views: {
      inbox_items_view: {
        Row: InboxItemsViewRow
        Relationships: []
      }
    }
    Functions: {
      update_part_confidence: {
        Args: {
          part_id: string
          confidence_delta?: number
        }
        Returns: number
      }
      add_part_evidence: {
        Args: {
          part_id: string
          evidence_item: Json
        }
        Returns: boolean
      }
      get_user_stats: {
        Args: {
          user_uuid: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// JSON type for Supabase
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// User Types
export interface UserSettings {
  timezone: string
  privacyMode: boolean
  aiDepth: 'light' | 'medium' | 'deep'
  notifications: {
    partEmergence: boolean
    sessionReminders: boolean
    weeklyInsights: boolean
  }
}

export interface UserStats {
  totalParts: number
  totalSessions: number
  streakDays: number
  longestSession: number
  averageSessionLength: number
}

export interface UserRow {
  id: string;
  [key: string]: unknown;
  email: string
  name: string | null
  settings: UserSettings
  stats: UserStats
  created_at: string
  updated_at: string
}

export interface UserInsert {
  id?: string
  email: string
  name?: string | null
  settings?: UserSettings
  stats?: UserStats
  created_at?: string
  updated_at?: string
}

export interface UserUpdate {
  id?: string
  email?: string
  name?: string | null
  settings?: UserSettings
  stats?: UserStats
  created_at?: string
  updated_at?: string
}

// Part Types
export type PartStatus = 'emerging' | 'acknowledged' | 'active' | 'integrated'
export type PartCategory = 'manager' | 'firefighter' | 'exile' | 'unknown'

export interface PartStory {
  origin: string | null
  currentState: string | null
  purpose: string | null
  evolution: Array<{
    timestamp: string
    change: string
    trigger?: string
  }>
}

export interface PartVisualization {
  emoji: string
  color: string
  energyLevel: number
}

export interface PartEvidence {
  type: 'direct_mention' | 'pattern' | 'behavior' | 'emotion'
  content: string
  confidence: number
  sessionId: string
  timestamp: string
}

export interface PartRow {
  id: string;
  [key: string]: unknown;
  user_id: string
  name: string
  status: PartStatus
  category: PartCategory
  age: number | null
  role: string | null
  triggers: string[]
  emotions: string[]
  beliefs: string[]
  somatic_markers: string[]
  confidence: number
  evidence_count: number
  recent_evidence: PartEvidence[]
  story: PartStory
  relationships: Json
  visualization: PartVisualization
  first_noticed: string
  acknowledged_at: string | null
  last_active: string
  last_interaction_at: string | null
  last_charged_at: string | null
  last_charge_intensity: number | null
  created_at: string
  updated_at: string
}

export interface PartInsert {
  id?: string
  user_id: string
  name: string
  status?: PartStatus
  category?: PartCategory
  age?: number | null
  role?: string | null
  triggers?: string[]
  emotions?: string[]
  beliefs?: string[]
  somatic_markers?: string[]
  confidence?: number
  evidence_count?: number
  recent_evidence?: PartEvidence[]
  story?: PartStory
  relationships?: Json
  visualization?: PartVisualization
  first_noticed?: string
  acknowledged_at?: string | null
  last_active?: string
  last_interaction_at?: string | null
  last_charged_at?: string | null
  last_charge_intensity?: number | null
  created_at?: string
  updated_at?: string
}

export interface PartUpdate {
  id?: string
  user_id?: string
  name?: string
  status?: PartStatus
  category?: PartCategory
  age?: number | null
  role?: string | null
  triggers?: string[]
  emotions?: string[]
  beliefs?: string[]
  somatic_markers?: string[]
  confidence?: number
  evidence_count?: number
  recent_evidence?: PartEvidence[]
  story?: PartStory
  relationships?: Json
  visualization?: PartVisualization
  first_noticed?: string
  acknowledged_at?: string | null
  last_active?: string
  last_interaction_at?: string | null
  last_charged_at?: string | null
  last_charge_intensity?: number | null
  created_at?: string
  updated_at?: string
}

// Part Note Types
export interface PartNoteRow {
  id: string;
  [key: string]: unknown;
  part_id: string
  content: string
  created_at: string
}

export interface PartNoteInsert {
  id?: string
  part_id: string
  content: string
  created_at?: string
}

export interface PartNoteUpdate {
  id?: string
  part_id?: string
  content?: string
  created_at?: string
}

// Session Types
export interface SessionMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  toolCalls?: Array<{
    name: string
    arguments: Json
    result?: Json
  }>
}

export interface PartInvolvement {
  partId: string
  activationLevel: number
  insights: string[]
  evidence: PartEvidence[]
}

export interface EmotionalState {
  valence: number // -1 (negative) to 1 (positive)
  arousal: number // 0 (calm) to 1 (excited)
}

export interface EmotionalArc {
  start: EmotionalState
  peak: EmotionalState
  end: EmotionalState
}

export interface SessionRow {
  id: string
  user_id: string
  start_time: string
  end_time: string | null
  duration: number | null
  messages: SessionMessage[]
  summary: string | null
  parts_involved: Record<string, PartInvolvement>
  new_parts: string[]
  breakthroughs: string[]
  emotional_arc: EmotionalArc
  processed: boolean
  processed_at: string | null
  created_at: string
  updated_at: string
}

export interface SessionInsert {
  id?: string
  user_id: string
  start_time?: string
  end_time?: string | null
  duration?: number | null
  messages?: SessionMessage[]
  summary?: string | null
  parts_involved?: Record<string, PartInvolvement>
  new_parts?: string[]
  breakthroughs?: string[]
  emotional_arc?: EmotionalArc
  processed?: boolean
  processed_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface SessionUpdate {
  id?: string
  user_id?: string
  start_time?: string
  end_time?: string | null
  duration?: number | null
  messages?: SessionMessage[]
  summary?: string | null
  parts_involved?: Record<string, PartInvolvement>
  new_parts?: string[]
  breakthroughs?: string[]
  emotional_arc?: EmotionalArc
  processed?: boolean
  processed_at?: string | null
  created_at?: string
  updated_at?: string
}

// Part Relationship Types
export type RelationshipType = 'polarized' | 'protector-exile' | 'allied'
export type RelationshipStatus = 'active' | 'healing' | 'resolved'

export interface RelationshipDynamic {
  timestamp: string
  observation: string
  context: string
  polarizationChange?: number
}

export interface PartRelationshipRow {
  id: string;
  [key: string]: unknown;
  user_id: string
  parts: string[] // Array of part IDs
  type: RelationshipType
  description: string | null
  issue: string | null
  common_ground: string | null
  dynamics: RelationshipDynamic[]
  status: RelationshipStatus
  polarization_level: number
  last_addressed: string | null
  created_at: string
  updated_at: string
}

export interface PartRelationshipInsert {
  id?: string
  user_id: string
  parts: string[]
  type: RelationshipType
  description?: string | null
  issue?: string | null
  common_ground?: string | null
  dynamics?: RelationshipDynamic[]
  status?: RelationshipStatus
  polarization_level?: number
  last_addressed?: string | null
  created_at?: string
  updated_at?: string
}

export interface PartRelationshipUpdate {
  id?: string
  user_id?: string
  parts?: string[]
  type?: RelationshipType
  description?: string | null
  issue?: string | null
  common_ground?: string | null
  dynamics?: RelationshipDynamic[]
  status?: RelationshipStatus
  polarization_level?: number
  last_addressed?: string | null
  created_at?: string
  updated_at?: string
}

// Part Change Proposal Types
export type ProposalType = 'split' | 'merge' | 'reclassify'
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executed'

export interface PartChangeProposalRow {
  id: string;
  [key: string]: unknown;
  user_id: string
  type: ProposalType
  payload: Json
  status: ProposalStatus
  rationale: string | null
  idempotency_key: string | null
  created_at: string
  approved_at: string | null
  approved_by: string | null
  executed_at: string | null
  executed_by: string | null
}

export interface PartChangeProposalInsert {
  id?: string
  user_id: string
  type: ProposalType
  payload?: Json
  status?: ProposalStatus
  rationale?: string | null
  idempotency_key?: string | null
  created_at?: string
  approved_at?: string | null
  approved_by?: string | null
  executed_at?: string | null
  executed_by?: string | null
}

export interface PartChangeProposalUpdate {
  id?: string
  user_id?: string
  type?: ProposalType
  payload?: Json
  status?: ProposalStatus
  rationale?: string | null
  idempotency_key?: string | null
  created_at?: string
  approved_at?: string | null
  approved_by?: string | null
  executed_at?: string | null
  executed_by?: string | null
}

// Part Assessment Types
export interface PartAssessmentRow {
  id: string
  user_id: string
  part_id: string
  source: 'agent_llm' | 'human'
  score: number
  rationale: string | null
  evidence_refs: Json
  model: string | null
  idempotency_key: string | null
  created_at: string
}

export interface PartAssessmentInsert {
  id?: string
  user_id: string
  part_id: string
  source: 'agent_llm' | 'human'
  score: number
  rationale?: string | null
  evidence_refs?: Json
  model?: string | null
  idempotency_key?: string | null
  created_at?: string
}

export interface PartAssessmentUpdate {
  id?: string
  user_id?: string
  part_id?: string
  source?: 'agent_llm' | 'human'
  score?: number
  rationale?: string | null
  evidence_refs?: Json
  model?: string | null
  idempotency_key?: string | null
  created_at?: string
}

// Insight Types
export type InsightType = 'session_summary' | 'nudge' | 'follow_up' | 'observation'
export type InsightStatus = 'pending' | 'revealed' | 'actioned'

export interface InsightContent {
  title: string
  body: string
  highlights?: string[]
  sourceSessionIds?: string[]
  [key: string]: Json | undefined
}

export interface InsightRating {
  scheme: 'quartile-v1' | string
  value: number
  label?: string
  [key: string]: Json | undefined
}

export interface InsightRow {
  id: string;
  [key: string]: unknown;
  user_id: string
  type: InsightType
  status: InsightStatus
  content: InsightContent
  rating: Json | null
  feedback: string | null
  revealed_at: string | null
  actioned_at: string | null
  meta: Json
  created_at: string
  updated_at: string
}

export interface InsightInsert {
  id?: string
  user_id: string
  type: InsightType
  status?: InsightStatus
  content: InsightContent
  rating?: Json | null
  feedback?: string | null
  revealed_at?: string | null
  actioned_at?: string | null
  meta?: Json
  created_at?: string
  updated_at?: string
}

export interface InsightUpdate {
  id?: string
  user_id?: string
  type?: InsightType
  status?: InsightStatus
  content?: InsightContent
  rating?: Json | null
  feedback?: string | null
  revealed_at?: string | null
  actioned_at?: string | null
  meta?: Json
  created_at?: string
  updated_at?: string
}

// Inbox Observation Types
export type InboxObservationStatus = 'pending' | 'queued' | 'confirmed' | 'dismissed'

export interface InboxObservationRow {
  id: string
  user_id: string
  status: InboxObservationStatus
  content: Json
  metadata: Json
  related_part_ids: string[]
  semantic_hash: string | null
  confidence: number | null
  timeframe_start: string | null
  timeframe_end: string | null
  created_at: string
  queued_at: string | null
  confirmed_at: string | null
  dismissed_at: string | null
  updated_at: string
}

export interface InboxObservationInsert {
  id?: string
  user_id: string
  status?: InboxObservationStatus
  content?: Json
  metadata?: Json
  related_part_ids?: string[]
  semantic_hash?: string | null
  confidence?: number | null
  timeframe_start?: string | null
  timeframe_end?: string | null
  created_at?: string
  queued_at?: string | null
  confirmed_at?: string | null
  dismissed_at?: string | null
  updated_at?: string
}

export interface InboxObservationUpdate {
  id?: string
  user_id?: string
  status?: InboxObservationStatus
  content?: Json
  metadata?: Json
  related_part_ids?: string[]
  semantic_hash?: string | null
  confidence?: number | null
  timeframe_start?: string | null
  timeframe_end?: string | null
  created_at?: string
  queued_at?: string | null
  confirmed_at?: string | null
  dismissed_at?: string | null
  updated_at?: string
}

export type ObservationEventType =
  | 'generated'
  | 'queued'
  | 'delivered'
  | 'confirmed'
  | 'dismissed'
  | 'skipped'
  | 'error'

export interface ObservationEventRow {
  id: string
  observation_id: string
  user_id: string
  event_type: ObservationEventType
  payload: Json
  created_at: string
}

export interface ObservationEventInsert {
  id?: string
  observation_id: string
  user_id: string
  event_type: ObservationEventType
  payload?: Json
  created_at?: string
}

export interface ObservationEventUpdate {
  id?: string
  observation_id?: string
  user_id?: string
  event_type?: ObservationEventType
  payload?: Json
  created_at?: string
}

export type InboxJobStatus = 'running' | 'success' | 'failed'

export interface InboxJobRunRow {
  id: string
  job_name: string
  status: InboxJobStatus
  started_at: string
  finished_at: string | null
  metadata: Json
  error: Json | null
  created_at: string
}

export interface InboxJobRunInsert {
  id?: string
  job_name: string
  status?: InboxJobStatus
  started_at?: string
  finished_at?: string | null
  metadata?: Json
  error?: Json | null
  created_at?: string
}

export interface InboxJobRunUpdate {
  id?: string
  job_name?: string
  status?: InboxJobStatus
  started_at?: string
  finished_at?: string | null
  metadata?: Json
  error?: Json | null
  created_at?: string
}

export type InboxItemRowStatus = InsightStatus | InboxObservationStatus | 'snoozed'

export interface InboxItemsViewRow {
  user_id: string
  source_type: 'insight' | 'part_follow_up' | 'observation'
  source_id: string
  status: InboxItemRowStatus
  content: Json
  part_id: string | null
  metadata: Json
  created_at: string
}

// API Response Types
export interface ApiError {
  error: string
  code: string
  details?: unknown
}

export interface ApiSuccess<T = unknown> {
  data: T
  message?: string
}

// Agent Tool Types
export interface ToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  confidence?: number
}

export interface PatternAnalysis {
  emergingPatterns: Array<{
    theme: string
    occurrences: number
    confidence: number
    suggestedPartName?: string
  }>
  activePatterns: Array<{
    partId: string
    recentActivations: number
    lastSeen: string
  }>
}

// Utility Types
export type Flatten<T> = T extends infer U ? { [K in keyof U]: U[K] } : never

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// Export the full database type
export type { Database as default }