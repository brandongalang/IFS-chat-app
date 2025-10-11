# Agent Loop Architecture

This document describes the agent loop implementation, tool orchestration, and context construction in Trailhead.

## Agent Loop Overview

The agent loop is the core execution cycle that processes user input, selects and executes tools, and generates responses.

### Execution Flow

```
1. Request arrives at /api/chat
   ↓
2. Load user profile + authentication context
   ↓
3. Bootstrap agent with system prompt + memory snapshot
   ↓
4. Construct conversation history (previous messages)
   ↓
5. LLM processes: system prompt + history + available tools
   ↓
6. LLM decides: text response OR tool call(s)
   ↓
7a. If text response → stream to client
7b. If tool call → execute tool + loop back to step 5
   ↓
8. Log all tool executions to agent_actions table
   ↓
9. Complete response → update session metadata
```

## Tool Orchestration

### Tool Registration

Tools are registered with the Mastra agent at initialization:

```typescript
// mastra/agents/ifs-agent.ts
const ifsAgent = new Agent({
  name: 'ifs-companion',
  instructions: IFS_AGENT_PROMPT,
  model: {
    provider: 'openrouter',
    name: IFS_MODEL,
    toolChoice: 'auto',
  },
  tools: {
    ...createPartTools(supabase, userId),
    ...createAssessmentTools(supabase, userId),
    ...createProposalTools(supabase, userId),
    ...createEvidenceTools(supabase, userId),
    ...createMemoryTools(supabase, userId),
    ...createRollbackTools(supabase, userId),
    // ... more tools
  },
});
```

### Tool Execution

When the LLM requests a tool:

1. **Validation**: Input validated against Zod schema
2. **Authorization**: User context verified (server-injected, never from client)
3. **Execution**: Tool function runs with validated inputs
4. **Logging**: Action logged to `agent_actions` table with:
   - Tool name
   - Input parameters
   - Output result
   - Timestamp
   - User ID
   - Session ID
5. **Result**: Tool output returned to LLM for next response generation

### Tool Categories

**Parts Management**
- `searchParts` - Search existing parts by name/attributes
- `createEmergingPart` - Create new part (requires evidence + confirmation)
- `updatePartAttributes` - Modify part details
- `getPartDetails` - Fetch full part information

**Assessments**
- `createPartAssessment` - Record part evaluation
- `listPartAssessments` - Retrieve assessment history

**Proposals**
- `createProposal` - Suggest action for user confirmation
- `updateProposal` - Update proposal status

**Evidence**
- `addEvidence` - Track evidence for part detection
- `listEvidence` - Retrieve evidence history

**Memory**
- `listMarkdown` - List available markdown files
- `readMarkdown` - Read markdown content
- `writeMarkdownSection` - Update markdown sections
- `createMarkdownFile` - Create new markdown file

**Rollback**
- `undoAction` - Reverse a logged action
- `listRecentActions` - View audit trail

## Context Construction

### System Prompt

The agent receives a detailed system prompt (`mastra/agents/ifs_agent_prompt.ts`) that includes:

- IFS methodology guidelines
- Tool usage instructions
- Evidence requirements for part creation
- Tone and boundaries (non-clinical, supportive)
- Error handling strategies

### Memory Snapshot

Before each chat session, the agent loads a memory snapshot:

```typescript
// lib/memory/overview.ts
const snapshot = await loadOverviewSnapshot(userId);
const fragments = formatOverviewFragments(snapshot.anchors);
```

This provides:
- User identity and focus
- Active parts and relationships
- Recent changes (change log)
- Session patterns

### Conversation History

Previous messages in the session are loaded and formatted for LLM context, maintaining conversational coherence.

## Termination Criteria

The agent loop terminates when:

1. **LLM returns final text response** (no tool calls)
2. **Maximum turns reached** (safety limit)
3. **Tool execution error** (graceful degradation)
4. **User interruption** (cancel request)

## Error Handling

### Tool Execution Failures

- Logged to `agent_actions` with error details
- Agent receives error message
- Agent can retry with adjusted parameters OR inform user

### LLM Failures

- Fallback to simpler model (if configured)
- Return cached/default response
- Log failure for monitoring

### Validation Failures

- Zod schema violations caught before execution
- Error returned to LLM for correction
- No database mutations occur

## Performance Considerations

- **Streaming**: Responses stream token-by-token to reduce perceived latency
- **Parallel Tools**: Some tools can execute in parallel (when independent)
- **Caching**: Memory snapshots cached per session
- **Rate Limiting**: Per-user request throttling (future enhancement)

## Related Documentation

- [Architecture Overview](./overview.md)
- [Agent Tools](../../docs/features/agent-tools.md)
- [User Memory System](../../docs/user-memory.md)
