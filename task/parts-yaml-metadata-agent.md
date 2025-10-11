# Task: Parts YAML Metadata Management via LLM Agent

## Objective

Build an LLM-powered agent/hook system that automatically maintains the YAML frontmatter in part markdown files based on conversation patterns, check-in data, and relationship inference.

## Context

- **Prerequisite**: Parts markdown migration (parts-garden-markdown-migration.md) must be complete
- **Separation principle**: YAML = structured metadata (machine-queryable), Markdown = narrative content (human-readable)
- **Conversational agent**: Only reads YAML, only writes markdown sections
- **Metadata agent**: Updates YAML based on patterns, events, and inference

## YAML Fields to Manage

```yaml
---
# Identity (rarely changes, can be user-edited)
id: "part_123"
name: "Inner Critic"
emoji: "🎭"

# Classification (user or agent can update)
category: "manager" | "firefighter" | "exile" | "unknown"
status: "active" | "archived"
tags: ["perfectionism", "performance", "anxiety"]

# Timestamps (system-managed)
created: "2025-01-01T00:00:00.000Z"
last_active: "2025-10-11T00:00:00.000Z"

# Activity tracking (auto-computed)
activity_metrics:
  check_in_count: 12
  last_check_in: "2025-10-11T00:00:00.000Z"
  total_mentions: 47
  interaction_frequency: "high" | "medium" | "low"

# Relationships (inferred from conversation)
related_parts:
  protects: ["part_456"]
  conflicts_with: ["part_789"]
  allied_with: []
---
```

## Implementation Approaches

### Option 1: Event-Driven Hooks (Recommended)

**Triggers:**
- After each conversation turn (if part mentioned)
- After check-in submission (for active parts)
- Periodic batch job (daily/weekly for relationship inference)

**Hook Implementation:**
```typescript
// lib/parts/metadata-hooks.ts

export async function onConversationTurn(userId: string, message: string) {
  // 1. Extract mentioned parts (LLM call)
  const mentioned = await extractMentionedParts(message);
  
  // 2. Update activity metrics for each
  for (const partId of mentioned) {
    await updatePartActivity(userId, partId, {
      last_active: now,
      total_mentions: increment,
    });
  }
  
  // 3. Infer tag additions (LLM call)
  const suggestedTags = await inferTagsFromContext(message, mentioned);
  await updatePartTags(userId, mentioned, suggestedTags);
  
  // 4. Detect relationship mentions (LLM call)
  const relationships = await inferRelationships(message);
  await updatePartRelationships(userId, relationships);
}

export async function onCheckInSubmit(userId: string, checkIn: CheckIn) {
  for (const partId of checkIn.selectedParts) {
    await updatePartActivity(userId, partId, {
      check_in_count: increment,
      last_check_in: now,
      last_active: now,
    });
  }
}
```

### Option 2: Dedicated Metadata Agent

**Agent Role:** Analyzes conversation history and part content to update YAML

**Tools (metadata agent only):**
- `analyze_conversation_for_parts` - Extract part mentions and context
- `infer_part_tags` - Suggest tags based on evidence/content
- `infer_part_relationships` - Detect protector/exile/conflict patterns
- `update_part_metadata` - Write YAML changes (guarded by agent role)

**Trigger:** Runs after conversations or on schedule

### Option 3: Hybrid (Event Hooks + Periodic Agent Review)

- **Hooks**: Handle immediate updates (activity metrics, timestamps)
- **Agent**: Runs periodically to infer complex patterns (tags, relationships)

## LLM Integration Points

### 1. Part Mention Extraction

**Input:** User message or conversation turn
**Output:** List of part IDs/names mentioned

```typescript
const prompt = `
Analyze this user message and identify any IFS parts mentioned:
Message: "${message}"

Known parts for this user:
${parts.map(p => `- ${p.name} (${p.emoji}): ${p.category}`).join('\n')}

Return JSON: { "mentioned_parts": [{ "id": "...", "confidence": 0.95 }] }
`;
```

### 2. Tag Inference

**Input:** Conversation context + part content
**Output:** Suggested tags

```typescript
const prompt = `
Based on this conversation and the part's current content, suggest relevant tags:

Conversation snippet: "${snippet}"

Part: ${part.name}
Current tags: ${part.tags.join(', ')}
Evidence: ${part.content.evidence}

Suggest up to 3 new tags that capture emerging themes.
Return JSON: { "suggested_tags": ["tag1", "tag2"], "reasoning": "..." }
`;
```

### 3. Relationship Inference

**Input:** Conversation or part content analysis
**Output:** Detected relationships

```typescript
const prompt = `
Analyze this conversation for IFS part relationships:

"${conversation}"

Known parts: ${parts.map(p => p.name).join(', ')}

Detect relationships:
- protects: Part A protects Part B from harm
- conflicts_with: Parts are in tension
- allied_with: Parts work together

Return JSON: {
  "relationships": [
    { "source": "part_123", "target": "part_456", "type": "protects", "confidence": 0.8 }
  ]
}
`;
```

### 4. Category Classification

**Input:** Part content, user descriptions
**Output:** Suggested category (manager/firefighter/exile)

```typescript
const prompt = `
Based on IFS theory, classify this part:

Part: ${part.name}
Role: ${part.content.role}
Evidence: ${part.content.evidence}

Managers: Proactive, planning, controlling
Firefighters: Reactive, distraction, numbing
Exiles: Vulnerable, carrying burdens, young

Return JSON: { "category": "manager", "confidence": 0.85, "reasoning": "..." }
`;
```

## Architecture Components

### 1. Metadata Service

```typescript
// lib/parts/metadata-service.ts

export class PartMetadataService {
  async updateActivity(userId: string, partId: string, updates: ActivityUpdate) {
    // Read part, update YAML only, write back
  }
  
  async addTags(userId: string, partId: string, tags: string[]) {
    // Dedupe and add tags
  }
  
  async updateRelationships(userId: string, partId: string, relationships: Relationships) {
    // Update relationship IDs
  }
  
  async computeInteractionFrequency(userId: string, partId: string): Promise<'high' | 'medium' | 'low'> {
    // Based on check_in_count and total_mentions over time
  }
}
```

### 2. LLM Analyzer

```typescript
// lib/parts/llm-analyzer.ts

export class PartLLMAnalyzer {
  async extractMentionedParts(message: string, userParts: Part[]): Promise<PartMention[]> {
    // LLM call to detect part mentions
  }
  
  async inferTags(context: string, part: Part): Promise<TagSuggestion[]> {
    // LLM call to suggest tags
  }
  
  async inferRelationships(conversation: string, parts: Part[]): Promise<Relationship[]> {
    // LLM call to detect relationships
  }
  
  async classifyCategory(part: Part): Promise<CategorySuggestion> {
    // LLM call to suggest category
  }
}
```

### 3. Hook Integration Points

```typescript
// In chat/conversation handler
import { onConversationTurn } from '@/lib/parts/metadata-hooks';

async function handleChatMessage(userId: string, message: string) {
  // ... existing chat logic
  
  // Trigger metadata update
  await onConversationTurn(userId, message);
}

// In check-in submission
import { onCheckInSubmit } from '@/lib/parts/metadata-hooks';

async function submitCheckIn(userId: string, checkIn: CheckIn) {
  // ... existing check-in logic
  
  // Trigger metadata update
  await onCheckInSubmit(userId, checkIn);
}
```

## Implementation Phases

### Phase 1: Basic Activity Tracking (No LLM)
- Hook: Update `last_active` on check-in
- Hook: Increment `check_in_count` on check-in
- Compute: `interaction_frequency` based on counts

### Phase 2: LLM-Powered Part Mention Detection
- Analyze conversation turns for part mentions
- Update `total_mentions` counter
- Update `last_active` on mention

### Phase 3: Tag Inference
- LLM analyzes conversation context
- Suggests tags based on themes
- Auto-add high-confidence tags (>0.9)
- Prompt user for medium-confidence tags (0.7-0.9)

### Phase 4: Relationship Inference
- LLM detects relationship patterns in conversation
- Updates `related_parts` with inferred relationships
- Documents relationship evidence in part's markdown

### Phase 5: Category Classification
- LLM suggests category based on behavior patterns
- Offers to reclassify parts as evidence accumulates
- User can accept/reject suggestions

## Guardrails

1. **Confidence thresholds**: Only auto-update high-confidence inferences
2. **User review**: Medium-confidence changes require user approval
3. **Audit trail**: Log all metadata changes with reasoning
4. **Rollback**: Support undo for automated changes
5. **Rate limiting**: Don't run expensive LLM calls on every message

## Testing Strategy

- Unit tests: Metadata service CRUD operations
- Integration tests: Hook triggers update correct fields
- LLM evaluation: Test prompt accuracy with fixture data
- End-to-end: Conversation → metadata update flow

## Success Metrics

- Metadata accuracy: Do inferred tags/relationships match user's mental model?
- Coverage: % of parts with auto-populated tags/relationships
- User friction: Do users accept or reject suggestions?
- Performance: Latency of metadata updates

## Open Questions

1. **LLM model choice**: GPT-4 for accuracy vs GPT-3.5 for cost?
2. **Batch vs streaming**: Update after each message or in batches?
3. **User control**: How much auto-update vs user approval?
4. **Conflict resolution**: What if LLM suggests contradictory metadata?

## Dependencies

- Parts markdown migration complete
- Conversational agent using markdown-only tools
- LLM infrastructure (OpenAI/Anthropic API)
- Event hook system in place

## Definition of Done

- [ ] Metadata service implements YAML-only updates
- [ ] LLM analyzer extracts part mentions from conversation
- [ ] LLM analyzer infers tags from context
- [ ] LLM analyzer detects relationships
- [ ] Hooks integrated into chat and check-in flows
- [ ] Confidence thresholds and user approval flows
- [ ] Audit logging for metadata changes
- [ ] Tests cover all inference scenarios
- [ ] Documentation for metadata update flows
