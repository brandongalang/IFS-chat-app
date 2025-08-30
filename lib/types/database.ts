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
      ,
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
      },
      customers: {
        Row: CustomerRow
        Insert: CustomerInsert
        Update: CustomerUpdate
        Relationships: [
          {
            foreignKeyName: 'customers_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      },
      products: {
        Row: ProductRow
        Insert: ProductInsert
        Update: ProductUpdate
        Relationships: []
      },
      prices: {
        Row: PriceRow
        Insert: PriceInsert
        Update: PriceUpdate
        Relationships: [
          {
            foreignKeyName: 'prices_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      },
      subscriptions: {
        Row: SubscriptionRow
        Insert: SubscriptionInsert
        Update: SubscriptionUpdate
        Relationships: [
          {
            foreignKeyName: 'subscriptions_price_id_fkey'
            columns: ['price_id']
            isOneToOne: false
            referencedRelation: 'prices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subscriptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
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
  id: string
  email: string
  name: string | null
  settings: UserSettings
  stats: UserStats
  created_at: string
  updated_at: string
  // Usage tracking fields
  daily_message_count: number
  last_message_date: string | null
}

export interface UserInsert {
  id?: string
  email: string
  name?: string | null
  settings?: UserSettings
  stats?: UserStats
  created_at?: string
  updated_at?: string
  // Usage tracking fields
  daily_message_count?: number
  last_message_date?: string | null
}

export interface UserUpdate {
  id?: string
  email?: string
  name?: string | null
  settings?: UserSettings
  stats?: UserStats
  created_at?: string
  updated_at?: string
  // Usage tracking fields
  daily_message_count?: number
  last_message_date?: string | null
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
  id: string
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
  created_at: string
  updated_at: string
  is_hidden: boolean
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
  created_at?: string
  updated_at?: string
  is_hidden?: boolean
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
  created_at?: string
  updated_at?: string
  is_hidden?: boolean
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
  id: string
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
  id: string
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
  id: string
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

// API Response Types
export interface ApiError {
  error: string
  code: string
  details?: Json
}

export interface ApiSuccess<T = any> {
  data: T
  message?: string
}

// Agent Tool Types
export interface ToolResult<T = any> {
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

// --- Stripe-related Types ---

// Customer Types
export interface CustomerRow {
  id: string // UUID of the user
  stripe_customer_id: string | null
}
export interface CustomerInsert {
  id: string
  stripe_customer_id?: string | null
}
export interface CustomerUpdate {
  id?: string
  stripe_customer_id?: string | null
}

// Product Types
export interface ProductRow {
  id: string // Stripe Product ID
  active: boolean | null
  name: string | null
  description: string | null
  image: string | null
  metadata: Json | null
}
export interface ProductInsert {
  id: string
  active?: boolean | null
  name?: string | null
  description?: string | null
  image?: string | null
  metadata?: Json | null
}
export interface ProductUpdate {
  id?: string
  active?: boolean | null
  name?: string | null
  description?: string | null
  image?: string | null
  metadata?: Json | null
}

// Price Types
export type PriceInterval = 'day' | 'week' | 'month' | 'year'
export interface PriceRow {
  id: string // Stripe Price ID
  product_id: string | null
  active: boolean | null
  description: string | null
  unit_amount: number | null
  currency: string | null
  type: 'one_time' | 'recurring' | null
  interval: PriceInterval | null
  interval_count: number | null
  trial_period_days: number | null
  metadata: Json | null
}
export interface PriceInsert {
  id: string
  product_id?: string | null
  active?: boolean | null
  description?: string | null
  unit_amount?: number | null
  currency?: string | null
  type?: 'one_time' | 'recurring' | null
  interval?: PriceInterval | null
  interval_count?: number | null
  trial_period_days?: number | null
  metadata?: Json | null
}
export interface PriceUpdate {
  id?: string
  product_id?: string | null
  active?: boolean | null
  description?: string | null
  unit_amount?: number | null
  currency?: string | null
  type?: 'one_time' | 'recurring' | null
  interval?: PriceInterval | null
  interval_count?: number | null
  trial_period_days?: number | null
  metadata?: Json | null
}

// Subscription Types
export type SubscriptionStatusEnum =
  | 'trialing'
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'unpaid'
  | 'paused'

export interface SubscriptionRow {
  id: string // Stripe Subscription ID
  user_id: string
  status: SubscriptionStatusEnum | null
  metadata: Json | null
  price_id: string | null
  quantity: number | null
  cancel_at_period_end: boolean | null
  created: string
  current_period_start: string
  current_period_end: string
  ended_at: string | null
  cancel_at: string | null
  canceled_at: string | null
  trial_start: string | null
  trial_end: string | null
}
export interface SubscriptionInsert {
  id: string
  user_id: string
  status?: SubscriptionStatusEnum | null
  metadata?: Json | null
  price_id?: string | null
  quantity?: number | null
  cancel_at_period_end?: boolean | null
  created?: string
  current_period_start?: string
  current_period_end?: string
  ended_at?: string | null
  cancel_at?: string | null
  canceled_at?: string | null
  trial_start?: string | null
  trial_end?: string | null
}
export interface SubscriptionUpdate {
  id?: string
  user_id?: string
  status?: SubscriptionStatusEnum | null
  metadata?: Json | null
  price_id?: string | null
  quantity?: number | null
  cancel_at_period_end?: boolean | null
  created?: string
  current_period_start?: string
  current_period_end?: string
  ended_at?: string | null
  cancel_at?: string | null
  canceled_at?: string | null
  trial_start?: string | null
  trial_end?: string | null
}

// Export the full database type
export type { Database as default }