import { a as createAdminClient, c as createClient } from './admin.mjs';
import { g as generateEventId, c as canonicalizeText, a as canonicalizeJson, h as hmacSha256Hex } from './canonicalize.mjs';

async function logEvent(input) {
  const sb = createAdminClient();
  const eventId = input.eventId || generateEventId();
  const secret = process.env.MEMORY_EVENTS_HMAC_SECRET || "dev-only-secret";
  const integrityText = input.integritySource ? input.integritySource.kind === "text" ? canonicalizeText(input.integritySource.value) : canonicalizeJson(input.integritySource.value) : canonicalizeJson({ userId: input.userId, type: input.type, ts: (/* @__PURE__ */ new Date()).toISOString() });
  const integrityLineHash = "hmac:" + hmacSha256Hex(secret, integrityText);
  const payload = {
    event_id: eventId,
    user_id: input.userId,
    schema_version: 1,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    type: input.type,
    op: input.op ?? null,
    section_anchor: input.sectionAnchor ?? null,
    file_path: input.filePath ?? null,
    rationale: input.rationale ?? null,
    before_hash: input.beforeHash ?? null,
    after_hash: input.afterHash ?? null,
    evidence_refs: Array.isArray(input.evidenceRefs) ? input.evidenceRefs : [],
    lint: input.lint ?? {},
    idempotency_key: input.idempotencyKey ?? null,
    transaction_id: input.transactionId ?? null,
    tool_call_id: input.toolCallId ?? null,
    integrity_line_hash: integrityLineHash,
    integrity_salt_version: "v1",
    status: input.status ?? "committed"
  };
  const { error } = await sb.from("events").insert(payload);
  if (error) throw error;
  return { eventId };
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
  async getRecentActions(_userId, _limit = 10, _actionTypes, _sessionId, _withinMinutes) {
    return [];
  }
  /**
   * Rollback an action by description/summary
   */
  async rollbackByDescription(_userId, description, _reason = "Agent rollback", _withinMinutes = 30) {
    return { success: false, message: `Rollback unavailable in Memory v2 (requested: ${description})` };
  }
  /**
   * Rollback a specific action by ID
   */
  async rollbackAction(_actionId, _reason = "Agent rollback") {
    return { success: false, message: "Rollback unavailable in Memory v2" };
  }
  /**
   * Private method to log an action
   */
  async logAction(params) {
    try {
      await logEvent({
        userId: params.userId,
        entityType: params.targetTable === "part_relationships" ? "relationship" : "part",
        entityId: params.targetId,
        type: "action",
        op: null,
        rationale: params.metadata?.changeDescription || null,
        evidenceRefs: [],
        lint: {},
        integritySource: { kind: "json", value: { old: params.oldState, new: params.newState, meta: params.metadata } },
        status: "committed"
      });
    } catch (error) {
      console.error("Failed to log event (Memory v2):", error);
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

var actionLogger$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  DatabaseActionLogger: DatabaseActionLogger,
  actionLogger: actionLogger
});

export { actionLogger as a, actionLogger$1 as b, logEvent as l };
