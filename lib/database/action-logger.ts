import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../supabase/client'
import { getSupabaseKey, getSupabaseUrl } from '../supabase/config'
import { logEvent } from '@/lib/memory/events-logger'
import type { Database } from '@/lib/types/database'

export type ActionType = 
  | 'create_emerging_part'
  | 'update_part_confidence' 
  | 'update_part_category'
  | 'update_part_attributes'
  | 'add_part_evidence'
  | 'acknowledge_part'
  | 'record_part_assessment'
  | 'confirm_insight'
  | 'dismiss_insight'
  | 'dismiss_part_follow_up'
  | 'create_relationship'
  | 'update_relationship'
  | 'create_session'
  | 'update_session'
  | 'end_session'
  | 'create_proposal'
  | 'approve_proposal'
  | 'reject_proposal'
  | 'execute_split'
  | 'execute_merge'

export interface ActionMetadata {
  partName?: string
  changeDescription?: string
  sessionId?: string
  confidenceDelta?: number
  fieldChanged?: string
  evidenceAdded?: boolean
  categoryChange?: { from: string; to: string }
  [key: string]: unknown
}

export interface DataObject {
    id: string;
    [key: string]: unknown;
}

export interface AgentAction {
  id: string
  user_id: string
  action_type: ActionType
  target_table: string
  target_id: string
  old_state: DataObject | null
  new_state: DataObject | null
  metadata: ActionMetadata
  created_at: string
  created_by: string
  rolled_back: boolean
  rollback_reason: string | null
  rollback_at: string | null
}

export interface ActionSummary {
  id: string
  summary: string
  timestamp: string
  canRollback: boolean
  actionType: ActionType
  metadata: ActionMetadata
}

export class DatabaseActionLogger {
  private supabase: SupabaseClient<Database>

  constructor(supabase?: SupabaseClient<Database>) {
    this.supabase = supabase ?? (createClient() as SupabaseClient<Database>)
  }

  /**
   * Log and execute an INSERT operation with rollback capability
   */
  async loggedInsert<T extends DataObject>(
    table: string,
    data: Partial<T>,
    userId: string,
    actionType: ActionType,
    metadata: ActionMetadata = {}
  ): Promise<T> {
    // Execute the insert
    const { data: result, error } = await this.supabase
      .from(table)
      .insert(data)
      .select()
      .single()

    if (error) throw error

    // Log the action
    await this.logAction({
      userId,
      actionType,
      targetTable: table,
      targetId: result.id,
      oldState: null, // No previous state for creates
      newState: result,
      metadata
    })

    return result
  }

  /**
   * Log and execute an UPDATE operation with rollback capability
   */
  async loggedUpdate<T extends DataObject>(
    table: string,
    id: string,
    updates: Partial<T>,
    userId: string,
    actionType: ActionType,
    metadata: ActionMetadata = {}
  ): Promise<T> {
    // First get the current state
    const { data: currentState, error: fetchError } = await this.supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    // Execute the update
    const { data: result, error } = await this.supabase
      .from(table)
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Log the action
    await this.logAction({
      userId,
      actionType,
      targetTable: table,
      targetId: id,
      oldState: currentState,
      newState: result,
      metadata
    })

    return result
  }

  /**
   * Get recent actions for a user with rich context
   */
  async getRecentActions(
    _userId: string,
    _limit: number = 10,
    _actionTypes?: ActionType[],
    _sessionId?: string,
    _withinMinutes?: number
  ): Promise<ActionSummary[]> {
    // Memory v2: legacy agent_actions removed. Expose empty list for now.
    return []
  }

  /**
   * Read recent action events from the events ledger
   */
  async getActionEvents(
    userId: string,
    limit: number = 10,
    withinMinutes: number = 30
  ): Promise<ActionSummary[]> {
    const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString()

    const query = this.supabase
      .from('events')
      .select('event_id, ts, rationale')
      .eq('user_id', userId)
      .eq('type', 'action')
      .gte('ts', cutoff)
      .order('ts', { ascending: false })
      .limit(limit)

    const { data, error } = await query
    if (error) throw error

    return (data || []).map((row: { event_id: string; rationale?: string; ts: string }) => ({
      id: row.event_id,
      summary: row.rationale || 'Agent action',
      timestamp: row.ts,
      canRollback: false,
      actionType: 'update_part_attributes' as ActionType,
      metadata: {}
    }))
  }

  /**
   * Rollback an action by description/summary
   */
async rollbackByDescription(
    _userId: string,
    description: string,
    _reason: string = 'Agent rollback',
    _withinMinutes: number = 30
  ): Promise<{ success: boolean; message: string; actionType?: ActionType }> {
    return { success: false, message: `Rollback unavailable in Memory v2 (requested: ${description})` }
  }

  /**
   * Rollback a specific action by ID
   */
async rollbackAction(
    _actionId: string,
    _reason: string = 'Agent rollback'
  ): Promise<{ success: boolean; message: string; actionType?: ActionType }> {
    return { success: false, message: 'Rollback unavailable in Memory v2' }
  }

  /**
   * Private method to log an action
   */
private async logAction(params: {
    userId: string
    actionType: ActionType
    targetTable: string
    targetId: string
    oldState: DataObject | null
    newState: DataObject | null
    metadata: ActionMetadata
  }) {
    try {
      await logEvent({
        userId: params.userId,
        entityType: params.targetTable === 'part_relationships' ? 'relationship' : 'part',
        entityId: params.targetId,
        type: 'action',
        op: null,
        rationale: params.metadata?.changeDescription || null,
        evidenceRefs: [],
        lint: {},
        integritySource: { kind: 'json', value: { old: params.oldState, new: params.newState, meta: params.metadata } },
        status: 'committed',
      })
    } catch (error) {
      console.error('Failed to log event (Memory v2):', error)
      // Don't throw - do not break primary operation
    }
  }

  /**
   * Generate human-readable summary of an action
   */
  private generateActionSummary(action: AgentAction): string {
    const metadata = action.metadata
    const partName = metadata.partName || 'Unknown Part'
    
    switch (action.action_type) {
      case 'create_emerging_part':
        return `Created emerging part "${partName}"`
      
      case 'update_part_confidence':
        const delta = metadata.confidenceDelta || 0
        const direction = delta > 0 ? 'increased' : 'decreased'
        return `${direction.charAt(0).toUpperCase() + direction.slice(1)} confidence for "${partName}" by ${Math.abs(delta)}`
      
      case 'update_part_category':
        const categoryChange = metadata.categoryChange
        if (categoryChange) {
          return `Changed "${partName}" category from ${categoryChange.from} to ${categoryChange.to}`
        }
        return `Updated category for "${partName}"`
      
      case 'update_part_attributes':
        return `Updated attributes for "${partName}": ${metadata.changeDescription || 'multiple fields'}`
      
case 'add_part_evidence':
        return `Added evidence for "${partName}"`
      
      case 'acknowledge_part':
        return `Acknowledged part "${partName}"`

      case 'record_part_assessment':
        return `Recorded identification assessment for "${partName}"${typeof metadata?.score === 'number' ? ` (score: ${metadata.score})` : ''}`

      case 'create_proposal':
        return `Created ${metadata?.proposalType || 'change'} proposal`

      case 'approve_proposal':
        return `Approved proposal ${metadata?.proposalId || ''}`

      case 'reject_proposal':
        return `Rejected proposal ${metadata?.proposalId || ''}`

      case 'execute_split':
        return `Executed split for "${partName}"`

      case 'execute_merge':
        return `Executed merge into "${partName}"`
      
      default:
        return `${action.action_type}: ${metadata.changeDescription || 'Unknown change'}`
    }
  }

  /**
   * Simple string similarity matching
   */
  private findBestMatch(description: string, actions: ActionSummary[]): ActionSummary | null {
    if (actions.length === 0) return null

    const descLower = description.toLowerCase()
    let bestMatch: ActionSummary | null = null
    let bestScore = 0

    for (const action of actions) {
      const summaryLower = action.summary.toLowerCase()
      
      // Simple word overlap scoring
      const descWords = descLower.split(/\s+/)
      const summaryWords = summaryLower.split(/\s+/)
      
      const overlap = descWords.filter(word => 
        word.length > 2 && summaryWords.some(sw => sw.includes(word) || word.includes(sw))
      ).length
      
      const score = overlap / Math.max(descWords.length, summaryWords.length)
      
      if (score > bestScore && score > 0.3) { // Minimum 30% similarity
        bestScore = score
        bestMatch = action
      }
    }

    return bestMatch
  }
}

// Export singleton instance
const supabaseUrl = getSupabaseUrl()
const supabaseKey = getSupabaseKey()
const hasSupabase =
  typeof supabaseUrl === 'string' &&
  /^https?:\/\//.test(supabaseUrl) &&
  typeof supabaseKey === 'string' &&
  supabaseKey.length > 20

export class NoopActionLogger {
  async loggedInsert<T extends DataObject>(_table: string, data: Partial<T>): Promise<T> {
    // Return the data as-is to simulate insert result
    return { ...data, id: 'noop' } as T
  }
  async loggedUpdate<T extends DataObject>(_table: string, id: string, updates: Partial<T>): Promise<T> {
    return { ...updates, id } as T
  }
  async getRecentActions() {
    return [] as ActionSummary[]
  }
  async getActionEvents() {
    return [] as ActionSummary[]
  }
  async rollbackByDescription(_userId: string, description: string) {
    return { success: false, message: `Rollback unavailable in dev (no Supabase). Requested: ${description}` }
  }
  async rollbackAction() {
    return { success: false, message: 'Rollback unavailable in dev (no Supabase).' }
  }
}

export type ActionLogger = DatabaseActionLogger | NoopActionLogger

export function createActionLogger(supabase?: SupabaseClient<Database>): ActionLogger {
  if (!hasSupabase) {
    return new NoopActionLogger()
  }
  return new DatabaseActionLogger(supabase)
}

export const actionLogger: ActionLogger = createActionLogger()
