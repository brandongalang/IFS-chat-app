import { createClient } from '../supabase/client'

export type ActionType = 
  | 'create_emerging_part'
  | 'update_part_confidence' 
  | 'update_part_category'
  | 'update_part_attributes'
  | 'add_part_evidence'
  | 'acknowledge_part'
  | 'record_part_assessment'
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
  [key: string]: any
}

export interface AgentAction {
  id: string
  user_id: string
  action_type: ActionType
  target_table: string
  target_id: string
  old_state: any
  new_state: any
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
  private supabase = createClient()

  /**
   * Log and execute an INSERT operation with rollback capability
   */
  async loggedInsert<T>(
    table: string,
    data: any,
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
  async loggedUpdate<T>(
    table: string,
    id: string,
    updates: any,
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
    userId: string,
    limit: number = 10,
    actionTypes?: ActionType[],
    sessionId?: string,
    withinMinutes?: number
  ): Promise<ActionSummary[]> {
    let query = this.supabase
      .from('agent_actions')
      .select('*')
      .eq('user_id', userId)
      .eq('rolled_back', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (actionTypes?.length) {
      query = query.in('action_type', actionTypes)
    }

    if (sessionId) {
      query = query.eq('metadata->sessionId', sessionId)
    }

    if (withinMinutes) {
      const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString()
      query = query.gte('created_at', cutoff)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map(action => ({
      id: action.id,
      summary: this.generateActionSummary(action),
      timestamp: action.created_at,
      canRollback: !action.rolled_back,
      actionType: action.action_type as ActionType,
      metadata: action.metadata as ActionMetadata
    }))
  }

  /**
   * Rollback an action by description/summary
   */
  async rollbackByDescription(
    userId: string,
    description: string,
    reason: string = 'Agent rollback',
    withinMinutes: number = 30
  ): Promise<{ success: boolean; message: string; actionType?: ActionType }> {
    // Get recent actions
    const recentActions = await this.getRecentActions(userId, 20, undefined, undefined, withinMinutes)
    
    // Find best match using simple string similarity
    const matchedAction = this.findBestMatch(description, recentActions)
    
    if (!matchedAction) {
      return {
        success: false,
        message: `No recent action found matching: "${description}"`
      }
    }

    return await this.rollbackAction(matchedAction.id, reason)
  }

  /**
   * Rollback a specific action by ID
   */
  async rollbackAction(
    actionId: string,
    reason: string = 'Agent rollback'
  ): Promise<{ success: boolean; message: string; actionType?: ActionType }> {
    // Get the action
    const { data: action, error } = await this.supabase
      .from('agent_actions')
      .select('*')
      .eq('id', actionId)
      .single()

    if (error || !action) {
      return {
        success: false,
        message: 'Action not found'
      }
    }

    if (action.rolled_back) {
      return {
        success: false,
        message: 'Action already rolled back'
      }
    }

    try {
      // Restore old state
      if (action.old_state) {
        // UPDATE rollback - restore previous state
        const { error: restoreError } = await this.supabase
          .from(action.target_table)
          .update(action.old_state)
          .eq('id', action.target_id)

        if (restoreError) throw restoreError
      } else {
        // CREATE rollback - delete the created record
        const { error: deleteError } = await this.supabase
          .from(action.target_table)
          .delete()
          .eq('id', action.target_id)

        if (deleteError) throw deleteError
      }

      // Mark action as rolled back
      await this.supabase
        .from('agent_actions')
        .update({
          rolled_back: true,
          rollback_reason: reason,
          rollback_at: new Date().toISOString()
        })
        .eq('id', actionId)

      return {
        success: true,
        message: `Successfully rolled back: ${this.generateActionSummary(action)}`,
        actionType: action.action_type as ActionType
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to rollback: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Private method to log an action
   */
  private async logAction(params: {
    userId: string
    actionType: ActionType
    targetTable: string
    targetId: string
    oldState: any
    newState: any
    metadata: ActionMetadata
  }) {
    const { error } = await this.supabase
      .from('agent_actions')
      .insert({
        user_id: params.userId,
        action_type: params.actionType,
        target_table: params.targetTable,
        target_id: params.targetId,
        old_state: params.oldState,
        new_state: params.newState,
        metadata: params.metadata,
        created_by: 'agent'
      })

    if (error) {
      console.error('Failed to log action:', error)
      // Don't throw - we don't want logging failures to break the main operation
    }
  }

  /**
   * Generate human-readable summary of an action
   */
  private generateActionSummary(action: any): string {
    const metadata = action.metadata as ActionMetadata
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
const hasSupabase =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
  /^https?:\/\//.test(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string' &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 20

class NoopActionLogger {
  async loggedInsert<T>(_table: string, data: any, _userId: string, _actionType: ActionType, _metadata: ActionMetadata = {}): Promise<T> {
    // Return the data as-is to simulate insert result
    return data as T
  }
  async loggedUpdate<T>(_table: string, _id: string, updates: any, _userId: string, _actionType: ActionType, _metadata: ActionMetadata = {}): Promise<T> {
    return updates as T
  }
  async getRecentActions(_userId: string, _limit = 10, _actionTypes?: ActionType[], _sessionId?: string, _withinMinutes?: number) {
    return [] as ActionSummary[]
  }
  async rollbackByDescription(_userId: string, description: string) {
    return { success: false, message: `Rollback unavailable in dev (no Supabase). Requested: ${description}` }
  }
  async rollbackAction(_actionId: string) {
    return { success: false, message: 'Rollback unavailable in dev (no Supabase).' }
  }
}

export const actionLogger: DatabaseActionLogger | NoopActionLogger = hasSupabase
  ? new DatabaseActionLogger()
  : new NoopActionLogger()
