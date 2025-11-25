/**
 * Unified Inbox Tools
 * 
 * Combines all 13 tools from insight-research-tools and inbox-observation-tools
 * into a single tool set for the unified inbox agent.
 * 
 * Tools are organized by category:
 * - Session/Part Discovery (4 from insight tools)
 * - Part Management (3 from observation tools)
 * - Therapy Data (3 from observation tools)
 * - Check-in Data (3 from observation tools)
 */

import { createInsightResearchTools } from './insight-research-tools'
import { createObservationResearchTools, type ObservationResearchTools } from './inbox-observation-tools'

export function createUnifiedInboxTools(
  baseUserId: string | null | undefined,
  ctx?: { requestId?: string; runId?: string },
) {
  // Get insight tools (4 tools)
  const insightTools = createInsightResearchTools(baseUserId ?? undefined)

  // Get observation tools (9 tools)
  const observationTools = createObservationResearchTools(baseUserId)

  // Combine all 13 tools
  return {
    // Session & Part Discovery (from insight tools)
    ...insightTools,

    // Therapy Data & Check-ins (from observation tools)
    ...observationTools,
  }
}

export type UnifiedInboxTools = ReturnType<typeof createUnifiedInboxTools>

/**
 * Tool catalog for documentation
 */
export const UNIFIED_INBOX_TOOL_CATALOG = {
  discoveryTools: [
    { id: 'getRecentSessions', source: 'insight', description: 'Fetch recent sessions (last 7-30 days)' },
    { id: 'getActiveParts', source: 'insight', description: 'Get recently active parts' },
    { id: 'getPolarizedRelationships', source: 'insight', description: 'Get conflicted part relationships' },
    { id: 'getRecentInsights', source: 'insight', description: 'Get previous insights (last 14-90 days)' },
  ],
  partTools: [
    { id: 'searchParts', source: 'observation', description: 'Search parts by name/status' },
    { id: 'getPartById', source: 'observation', description: 'Get specific part' },
    { id: 'getPartDetail', source: 'observation', description: 'Get part with full history' },
  ],
  therapyTools: [
    { id: 'queryTherapyData', source: 'observation', description: 'Query observations, notes, relationships' },
    { id: 'writeTherapyData', source: 'observation', description: 'Write new therapy data' },
    { id: 'updateTherapyData', source: 'observation', description: 'Update existing therapy data' },
  ],
  checkinTools: [
    { id: 'listCheckIns', source: 'observation', description: 'List recent check-ins' },
    { id: 'searchCheckIns', source: 'observation', description: 'Search check-in content' },
    { id: 'getCheckInDetail', source: 'observation', description: 'Get specific check-in detail' },
  ],
  totalTools: 13,
  insightTools: 4,
  observationTools: 9,
} as const
