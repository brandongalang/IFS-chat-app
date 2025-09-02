import { createBrowserClient } from '@supabase/ssr';

function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  return createBrowserClient(url, key);
}

class DatabaseActionLogger {
  constructor() {
    this.supabase = createClient();
  }
  /**
   * Log and execute an INSERT operation with rollback capability
   */
  async loggedInsert(table, data, userId, actionType, metadata = {}) {
    const { data: result, error } = await this.supabase.from(table).insert(data).select().single();
    if (error) throw error;
    await this.logAction({
      userId,
      actionType,
      targetTable: table,
      targetId: result.id,
      oldState: null,
      // No previous state for creates
      newState: result,
      metadata
    });
    return result;
  }
  /**
   * Log and execute an UPDATE operation with rollback capability
   */
  async loggedUpdate(table, id, updates, userId, actionType, metadata = {}) {
    const { data: currentState, error: fetchError } = await this.supabase.from(table).select("*").eq("id", id).single();
    if (fetchError) throw fetchError;
    const { data: result, error } = await this.supabase.from(table).update(updates).eq("id", id).select().single();
    if (error) throw error;
    await this.logAction({
      userId,
      actionType,
      targetTable: table,
      targetId: id,
      oldState: currentState,
      newState: result,
      metadata
    });
    return result;
  }
  /**
   * Get recent actions for a user with rich context
   */
  async getRecentActions(userId, limit = 10, actionTypes, sessionId, withinMinutes) {
    let query = this.supabase.from("agent_actions").select("*").eq("user_id", userId).eq("rolled_back", false).order("created_at", { ascending: false }).limit(limit);
    if (actionTypes?.length) {
      query = query.in("action_type", actionTypes);
    }
    if (sessionId) {
      query = query.eq("metadata->sessionId", sessionId);
    }
    if (withinMinutes) {
      const cutoff = new Date(Date.now() - withinMinutes * 60 * 1e3).toISOString();
      query = query.gte("created_at", cutoff);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((action) => ({
      id: action.id,
      summary: this.generateActionSummary(action),
      timestamp: action.created_at,
      canRollback: !action.rolled_back,
      actionType: action.action_type,
      metadata: action.metadata
    }));
  }
  /**
   * Rollback an action by description/summary
   */
  async rollbackByDescription(userId, description, reason = "Agent rollback", withinMinutes = 30) {
    const recentActions = await this.getRecentActions(userId, 20, void 0, void 0, withinMinutes);
    const matchedAction = this.findBestMatch(description, recentActions);
    if (!matchedAction) {
      return {
        success: false,
        message: `No recent action found matching: "${description}"`
      };
    }
    return await this.rollbackAction(matchedAction.id, reason);
  }
  /**
   * Rollback a specific action by ID
   */
  async rollbackAction(actionId, reason = "Agent rollback") {
    const { data: action, error } = await this.supabase.from("agent_actions").select("*").eq("id", actionId).single();
    if (error || !action) {
      return {
        success: false,
        message: "Action not found"
      };
    }
    if (action.rolled_back) {
      return {
        success: false,
        message: "Action already rolled back"
      };
    }
    try {
      if (action.old_state) {
        const { error: restoreError } = await this.supabase.from(action.target_table).update(action.old_state).eq("id", action.target_id);
        if (restoreError) throw restoreError;
      } else {
        const { error: deleteError } = await this.supabase.from(action.target_table).delete().eq("id", action.target_id);
        if (deleteError) throw deleteError;
      }
      await this.supabase.from("agent_actions").update({
        rolled_back: true,
        rollback_reason: reason,
        rollback_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", actionId);
      return {
        success: true,
        message: `Successfully rolled back: ${this.generateActionSummary(action)}`,
        actionType: action.action_type
      };
    } catch (error2) {
      return {
        success: false,
        message: `Failed to rollback: ${error2 instanceof Error ? error2.message : "Unknown error"}`
      };
    }
  }
  /**
   * Private method to log an action
   */
  async logAction(params) {
    const { error } = await this.supabase.from("agent_actions").insert({
      user_id: params.userId,
      action_type: params.actionType,
      target_table: params.targetTable,
      target_id: params.targetId,
      old_state: params.oldState,
      new_state: params.newState,
      metadata: params.metadata,
      created_by: "agent"
    });
    if (error) {
      console.error("Failed to log action:", error);
    }
  }
  /**
   * Generate human-readable summary of an action
   */
  generateActionSummary(action) {
    const metadata = action.metadata;
    const partName = metadata.partName || "Unknown Part";
    switch (action.action_type) {
      case "create_emerging_part":
        return `Created emerging part "${partName}"`;
      case "update_part_confidence":
        const delta = metadata.confidenceDelta || 0;
        const direction = delta > 0 ? "increased" : "decreased";
        return `${direction.charAt(0).toUpperCase() + direction.slice(1)} confidence for "${partName}" by ${Math.abs(delta)}`;
      case "update_part_category":
        const categoryChange = metadata.categoryChange;
        if (categoryChange) {
          return `Changed "${partName}" category from ${categoryChange.from} to ${categoryChange.to}`;
        }
        return `Updated category for "${partName}"`;
      case "update_part_attributes":
        return `Updated attributes for "${partName}": ${metadata.changeDescription || "multiple fields"}`;
      case "add_part_evidence":
        return `Added evidence for "${partName}"`;
      case "acknowledge_part":
        return `Acknowledged part "${partName}"`;
      case "record_part_assessment":
        return `Recorded identification assessment for "${partName}"${typeof metadata?.score === "number" ? ` (score: ${metadata.score})` : ""}`;
      case "create_proposal":
        return `Created ${metadata?.proposalType || "change"} proposal`;
      case "approve_proposal":
        return `Approved proposal ${metadata?.proposalId || ""}`;
      case "reject_proposal":
        return `Rejected proposal ${metadata?.proposalId || ""}`;
      case "execute_split":
        return `Executed split for "${partName}"`;
      case "execute_merge":
        return `Executed merge into "${partName}"`;
      default:
        return `${action.action_type}: ${metadata.changeDescription || "Unknown change"}`;
    }
  }
  /**
   * Simple string similarity matching
   */
  findBestMatch(description, actions) {
    if (actions.length === 0) return null;
    const descLower = description.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;
    for (const action of actions) {
      const summaryLower = action.summary.toLowerCase();
      const descWords = descLower.split(/\s+/);
      const summaryWords = summaryLower.split(/\s+/);
      const overlap = descWords.filter(
        (word) => word.length > 2 && summaryWords.some((sw) => sw.includes(word) || word.includes(sw))
      ).length;
      const score = overlap / Math.max(descWords.length, summaryWords.length);
      if (score > bestScore && score > 0.3) {
        bestScore = score;
        bestMatch = action;
      }
    }
    return bestMatch;
  }
}
const hasSupabase = typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" && /^https?:\/\//.test(process.env.NEXT_PUBLIC_SUPABASE_URL) && typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 20;
class NoopActionLogger {
  async loggedInsert(_table, data) {
    return { ...data, id: "noop" };
  }
  async loggedUpdate(_table, id, updates) {
    return { ...updates, id };
  }
  async getRecentActions() {
    return [];
  }
  async rollbackByDescription(_userId, description) {
    return { success: false, message: `Rollback unavailable in dev (no Supabase). Requested: ${description}` };
  }
  async rollbackAction() {
    return { success: false, message: "Rollback unavailable in dev (no Supabase)." };
  }
}
const actionLogger = hasSupabase ? new DatabaseActionLogger() : new NoopActionLogger();

export { actionLogger as a };
