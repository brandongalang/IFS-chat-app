# IFS Therapy App - Master Data Schema & Agent Tools PRD

**Date**: January 2025  
**Status**: In Progress (Updated 2025-10-14)  
**Version**: 1.0

## Executive Summary

This document defines the complete data architecture and agent tooling for an IFS (Internal Family Systems) therapy application. The design prioritizes:

1. **Therapist-oriented data capture** - Natural, flexible observation tracking
2. **UI-optimized retrieval** - Fast, structured queries for display
3. **Agent intelligence** - Simple tools with smart context management
4. **Progressive discovery** - Parts emerge gradually through conversation

## Core Architecture Principles

### 1. Two-Layer Data System

**Raw Data Layer (PostgreSQL)**

- Flexible observations table for therapist-style notes
- Parts table with minimal required fields + JSONB for flexibility
- Automatic session management
- Full-text search capabilities

**Context Layer (Computed Views)**

- Pre-computed summaries for agent warm-up
- UI-specific views for fast rendering
- Materialized views for complex aggregations
- Hot cache for frequently accessed data

### 2. Agent Context Management

The agent operates with a "warm start" - pre-loaded with relevant context rather than starting cold. This mirrors how a therapist reviews notes before a session.

### 3. Progressive Part Discovery

Parts aren't "created" - they're discovered. The system supports incomplete data, placeholder names, and gradual enrichment as understanding deepens.

## Database Schema

### Core Tables

```sql
-- Flexible observations table (therapist thinking)
CREATE TABLE observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id UUID,
    type TEXT, -- 'part_behavior', 'resistance', 'breakthrough', 'somatic', 'pattern', etc
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- {followUp: true, tags: [...], confidence: 0.8}
    entities UUID[], -- Parts or other entities mentioned
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Full-text search
    search_vector tsvector GENERATED ALWAYS AS (
      to_tsvector('english', content)
    ) STORED
);

-- Parts table (minimal required fields)
CREATE TABLE parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT, -- Can be null initially
    placeholder TEXT, -- "That anxious feeling", "chest tightness"

    -- Core attributes (nullable for gradual discovery)
    category TEXT DEFAULT 'unknown' CHECK (category IN ('manager', 'firefighter', 'exile', 'unknown')),
    status TEXT DEFAULT 'emerging' CHECK (status IN ('emerging', 'acknowledged', 'active', 'integrated')),
    charge TEXT DEFAULT 'neutral' CHECK (charge IN ('positive', 'negative', 'neutral')),

    -- Flexible data storage
    data JSONB DEFAULT '{}', -- age, role, emoji, triggers, beliefs, somatic_markers, etc

    -- Tracking
    needs_attention BOOLEAN DEFAULT false, -- Flag for incomplete parts
    confidence FLOAT DEFAULT 0.0,
    evidence_count INTEGER DEFAULT 0,

    -- Timestamps
    first_noticed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Search
    search_vector tsvector GENERATED ALWAYS AS (
      to_tsvector('english', COALESCE(name, placeholder, '') || ' ' || COALESCE(data->>'role', ''))
    ) STORED
);

-- Sessions (automatic management)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type TEXT DEFAULT 'therapy', -- 'therapy', 'check_in', 'exploration'

    -- Running notes during session
    observations UUID[], -- Links to observation IDs
    parts_present UUID[], -- Parts that showed up

    -- Post-session summary (created by summarizer)
    summary TEXT,
    key_insights TEXT[],
    breakthroughs TEXT[],
    resistance_notes TEXT[],
    homework TEXT[], -- Things for user to notice
    next_session TEXT[], -- Topics for next time

    -- Metadata
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Part relationships
CREATE TABLE part_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_a_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    part_b_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'protects', 'conflicts', 'supports', 'triggers', 'soothes'
    strength FLOAT DEFAULT 0.5,
    context TEXT, -- "Only conflicts about money"
    observations TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(part_a_id, part_b_id, type)
);

-- Timeline events (auto-generated)
CREATE TABLE timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id UUID REFERENCES sessions(id),
    type TEXT NOT NULL, -- 'part_emerged', 'breakthrough', 'integration', 'relationship_discovered'
    description TEXT,
    entities UUID[], -- Related parts
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_obs_user_type ON observations(user_id, type);
CREATE INDEX idx_obs_session ON observations(session_id);
CREATE INDEX idx_obs_search ON observations USING GIN(search_vector);
CREATE INDEX idx_obs_entities ON observations USING GIN(entities);
CREATE INDEX idx_obs_follow_up ON observations(user_id, created_at)
  WHERE metadata->>'followUp' = 'true';

CREATE INDEX idx_parts_user ON parts(user_id);
CREATE INDEX idx_parts_needs_attention ON parts(user_id, needs_attention)
  WHERE needs_attention = true;
CREATE INDEX idx_parts_search ON parts USING GIN(search_vector);

CREATE INDEX idx_sessions_user ON sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_active ON sessions(user_id)
  WHERE ended_at IS NULL;

CREATE INDEX idx_timeline_user ON timeline_events(user_id, created_at DESC);
```

### Computed Views for UI

```sql
-- View for parts list UI
CREATE VIEW parts_display AS
SELECT
    p.id,
    COALESCE(p.name, p.placeholder, 'Unnamed Part') as display_name,
    p.category,
    p.status,
    p.charge,
    p.data->>'emoji' as emoji,
    p.data->>'age' as age,
    p.data->>'role' as role,
    p.confidence,
    p.evidence_count,
    p.needs_attention,
    p.last_active,
    p.created_at,
    (SELECT COUNT(*) FROM observations WHERE p.id = ANY(entities)) as observation_count,
    (SELECT COUNT(*) FROM part_relationships WHERE part_a_id = p.id OR part_b_id = p.id) as relationship_count
FROM parts p;

-- View for timeline UI
CREATE VIEW timeline_display AS
SELECT
    created_at,
    'observation' as event_type,
    type as event_subtype,
    content as description,
    entities,
    metadata
FROM observations
UNION ALL
SELECT
    created_at,
    'part_created' as event_type,
    status as event_subtype,
    COALESCE(name, placeholder, 'New part emerged') as description,
    ARRAY[id] as entities,
    data as metadata
FROM parts
UNION ALL
SELECT
    created_at,
    'relationship' as event_type,
    type as event_subtype,
    'Relationship discovered' as description,
    ARRAY[part_a_id, part_b_id] as entities,
    jsonb_build_object('strength', strength) as metadata
FROM part_relationships
ORDER BY created_at DESC;

-- Hot cache for agent context
CREATE MATERIALIZED VIEW user_context_cache AS
SELECT
    u.id as user_id,

    -- Recent parts (for quick reference)
    (SELECT json_agg(p) FROM (
        SELECT id, name, placeholder, category, status, last_active,
               data->>'emoji' as emoji,
               needs_attention
        FROM parts
        WHERE user_id = u.id
        ORDER BY last_active DESC
        LIMIT 5
    ) p) as recent_parts,

    -- Parts needing attention
    (SELECT json_agg(p) FROM (
        SELECT id, COALESCE(name, placeholder) as display_name,
               CASE
                   WHEN name IS NULL THEN 'needs_name'
                   WHEN data->>'role' IS NULL THEN 'needs_role'
                   WHEN category = 'unknown' THEN 'needs_category'
                   ELSE 'needs_details'
               END as next_step
        FROM parts
        WHERE user_id = u.id AND needs_attention = true
        LIMIT 5
    ) p) as incomplete_parts,

    -- Follow-ups
    (SELECT json_agg(f) FROM (
        SELECT content, type, created_at
        FROM observations
        WHERE user_id = u.id
          AND metadata->>'followUp' = 'true'
          AND metadata->>'completed' IS NULL
        ORDER BY created_at DESC
        LIMIT 10
    ) f) as follow_ups,

    -- Last session info
    (SELECT row_to_json(s) FROM (
        SELECT id, type, summary, key_insights, homework, next_session,
               started_at, ended_at
        FROM sessions
        WHERE user_id = u.id
        ORDER BY started_at DESC
        LIMIT 1
    ) s) as last_session,

    -- Time context
    NOW() as cache_time,
    (SELECT MAX(created_at) FROM observations WHERE user_id = u.id) as last_observation,
    (SELECT COUNT(*) FROM sessions WHERE user_id = u.id) as total_sessions

FROM users u;

-- Refresh periodically
CREATE INDEX idx_context_cache_user ON user_context_cache(user_id);
```

## Agent Tools Architecture

### Core Philosophy: Simple Tools, Smart Usage

Instead of many specialized tools, we use a few flexible tools that the agent can apply intelligently based on context.

### Tool Set

```typescript
// 1. Universal Write Tool - Handles all data capture
interface WriteTherapyDataTool {
  description: 'Write any therapeutic observation or data';
  params: {
    userId: string;
    type: 'observation' | 'part' | 'relationship' | 'note';
    data: {
      // Flexible based on type
      content?: string;
      name?: string;
      placeholder?: string;
      partIds?: string[];
      metadata?: Record<string, any>;
    };
    context?: {
      sessionId?: string;
      partId?: string;
      relatedTo?: string[];
    };
  };
}

// 2. Smart Query Tool - Context-aware retrieval
interface QueryTherapyDataTool {
  description: 'Query therapeutic data with smart filtering';
  params: {
    userId: string;
    query: {
      type?: 'parts' | 'observations' | 'sessions' | 'relationships';
      filters?: {
        category?: string;
        status?: string;
        needsAttention?: boolean;
        followUp?: boolean;
        search?: string;
        timeRange?: { start: Date; end: Date };
      };
      include?: string[]; // "evidence", "relationships", "recent"
      limit?: number;
    };
  };
}

// 3. Update Tool - Modify existing data
interface UpdateTherapyDataTool {
  description: 'Update existing therapeutic data';
  params: {
    userId: string;
    type: 'part' | 'observation' | 'session';
    id: string;
    updates: Record<string, any>;
  };
}

// 4. Context Tool - Get session context
interface GetSessionContextTool {
  description: 'Get relevant context for current session';
  params: {
    userId: string;
  };
  returns: {
    timeSinceLastContact: string;
    lastTopics: string[];
    openThreads: string[];
    partsActive: PartSummary[];
    suggestedFocus: string;
    recentMood?: string;
    upcomingReminders?: string[];
  };
}
```

### Tool Usage Examples

```typescript
// Example 1: User mentions feeling anxious
// Agent recognizes an emerging part
await writeTherapyDataTool({
  userId: 'xxx',
  type: 'observation',
  data: {
    content: 'User feeling anxious about work presentation',
    metadata: {
      somatic: true,
      location: 'chest',
      intensity: 0.7,
    },
  },
});

// Example 2: Part becomes clearer
await writeTherapyDataTool({
  userId: 'xxx',
  type: 'part',
  data: {
    placeholder: 'Work anxiety - perfectionist',
    metadata: {
      triggers: ['presentations', 'being judged'],
      firstNoticed: "During discussion about tomorrow's meeting",
    },
  },
});

// Example 3: User names the part
await updateTherapyDataTool({
  userId: 'xxx',
  type: 'part',
  id: 'part-id',
  updates: {
    name: 'The Perfectionist',
    placeholder: null,
    needsAttention: false,
    data: {
      ...existingData,
      role: 'Ensures I never fail or disappoint',
    },
  },
});

// Example 4: Query for context
const context = await getSessionContextTool({
  userId: 'xxx',
});
// Returns pre-computed context from cache
```

## Session Management

### Automatic Session Creation

Sessions are created and managed automatically based on user interaction patterns:

```typescript
class SessionManager {
  async handleUserMessage(userId: string, message: string) {
    // Get or create session
    const session = await this.getOrCreateSession(userId);

    // Auto-save observations during conversation
    if (this.hasTherapeuticContent(message)) {
      await writeTherapyDataTool({
        userId,
        type: 'observation',
        data: {
          content: this.extractKeyPoints(message),
          metadata: { sessionId: session.id },
        },
      });
    }

    // Update session activity
    await this.updateSessionActivity(session.id);
  }

  private async getOrCreateSession(userId: string) {
    // Check for active session
    const activeSession = await db.query(
      `SELECT * FROM sessions 
       WHERE user_id = $1 
         AND ended_at IS NULL 
         AND last_message_at > NOW() - INTERVAL '30 minutes'`,
      [userId]
    );

    if (activeSession) {
      return activeSession;
    }

    // Create new session
    return await db.query(
      `INSERT INTO sessions (user_id, type) 
       VALUES ($1, $2) 
       RETURNING *`,
      [userId, this.inferSessionType()]
    );
  }
}
```

### Post-Session Processing

After a session ends (30 minutes of inactivity), a background process summarizes:

```typescript
class SessionSummarizer {
  async summarizeSession(sessionId: string) {
    // Get all observations from session
    const observations = await db.query(
      `SELECT * FROM observations 
       WHERE session_id = $1 
       ORDER BY created_at`,
      [sessionId]
    );

    // Use LLM to summarize
    const summary = await llm.complete({
      prompt: `Summarize this therapy session:
        - Key themes
        - Parts that emerged or were active
        - Breakthroughs or resistance
        - Items for follow-up
        
        Observations: ${observations.map((o) => o.content).join('\n')}`,
    });

    // Update session with summary
    await db.query(
      `UPDATE sessions 
       SET summary = $1,
           key_insights = $2,
           homework = $3,
           next_session = $4,
           ended_at = NOW()
       WHERE id = $5`,
      [summary.text, summary.insights, summary.homework, summary.followUp, sessionId]
    );

    // Update parts mentioned
    await this.updatePartActivity(sessionId, summary.partsmentioned);

    // Create timeline events for significant moments
    await this.createTimelineEvents(sessionId, summary.breakthroughs);
  }
}
```

## Agent Context Loading

### Initial Context (Warm Start)

When an agent starts a conversation, it receives pre-computed context:

```typescript
interface AgentContext {
  user: {
    id: string;
    lastSeen: Date;
    timezone: string;
    sessionCount: number;
  };

  // Compact summaries from cache
  partsSummary: {
    active: Array<{
      id: string;
      name: string;
      lastSeen: string;
      keyTriggers: string[];
    }>;
    emerging: Array<{
      id: string;
      placeholder: string;
      needsAttention: boolean;
    }>;
  };

  // What to follow up on
  followUps: {
    fromLastSession: string[];
    checkIns: string[];
    patterns: string[];
  };

  // Recent context
  recentActivity: {
    lastSessionSummary?: string;
    hoursSinceLastContact: number;
    currentTimeContext: string; // "morning", "evening", etc
  };
}

// Load context from materialized view
async function loadAgentContext(userId: string): AgentContext {
  const cache = await db.query(`SELECT * FROM user_context_cache WHERE user_id = $1`, [userId]);

  return {
    user: {
      id: userId,
      lastSeen: cache.last_observation,
      timezone: getUserTimezone(userId),
      sessionCount: cache.total_sessions,
    },
    partsSummary: {
      active: cache.recent_parts?.filter((p) => !p.needs_attention) || [],
      emerging: cache.incomplete_parts || [],
    },
    followUps: {
      fromLastSession: cache.last_session?.next_session || [],
      checkIns: cache.last_session?.homework || [],
      patterns: cache.follow_ups?.map((f) => f.content) || [],
    },
    recentActivity: {
      lastSessionSummary: cache.last_session?.summary,
      hoursSinceLastContact: calculateHoursSince(cache.last_observation),
      currentTimeContext: getTimeContext(getUserTimezone(userId)),
    },
  };
}
```

### Context-Aware Responses

The agent uses context to provide relevant, timely responses:

```typescript
class TherapyAgent {
  private context: AgentContext;

  async handleMessage(userId: string, message: string) {
    // Load context if not already loaded
    if (!this.context) {
      this.context = await loadAgentContext(userId);
    }

    // Generate contextual response
    const response = await this.generateResponse(message);

    // Track observations
    await this.trackObservations(message, response);

    return response;
  }

  private async generateResponse(message: string) {
    // Check for returning user
    if (this.context.recentActivity.hoursSinceLastContact > 72) {
      return this.generateReturningUserResponse();
    }

    // Check for follow-ups
    if (this.hasRelevantFollowUp(message)) {
      return this.generateFollowUpResponse();
    }

    // Check for emerging parts
    if (this.detectsEmergingPart(message)) {
      return this.generatePartExplorationResponse();
    }

    // Default therapeutic response
    return this.generateTherapeuticResponse(message);
  }
}
```

## Progressive Part Discovery

Parts emerge gradually through conversation. The system supports this natural discovery process:

### Stage 1: Initial Sensing

```typescript
// User: "I feel this tightness in my chest"
await writeTherapyDataTool({
  type: 'observation',
  data: {
    content: 'Tightness in chest',
    metadata: {
      somatic: true,
      location: 'chest',
      followUp: true,
    },
  },
});
```

### Stage 2: Part Emergence

```typescript
// User: "It feels protective, like it's trying to keep me safe"
await writeTherapyDataTool({
  type: 'part',
  data: {
    placeholder: 'Chest tightness - protective',
    data: {
      somaticMarkers: ['chest tightness'],
      qualities: ['protective'],
      purpose: 'keeping safe',
    },
  },
});
```

### Stage 3: Part Recognition

```typescript
// User: "I think this is my Guardian part"
await updateTherapyDataTool({
  type: 'part',
  id: 'part-id',
  updates: {
    name: 'Guardian',
    placeholder: null,
    category: 'manager',
    needsAttention: false,
  },
});
```

### Stage 4: Part Understanding

```typescript
// Through continued exploration
await updateTherapyDataTool({
  type: 'part',
  id: 'part-id',
  updates: {
    data: {
      ...existing,
      role: 'Protects from emotional overwhelm',
      age: 7,
      origin: 'Formed when parents divorced',
      triggers: ['conflict', 'raised voices'],
      beliefs: ['I must keep everyone calm'],
    },
    status: 'active',
    confidence: 0.8,
  },
});
```

## Implementation Timeline

### Phase 1: Core Infrastructure (Week 1-2)

- Database schema creation
- Basic CRUD operations
- Session management
- Agent tools implementation

**Progress (2025-10-14)**
- ✅ Core database tables (`parts_v2`, `sessions_v2`, `observations`, `part_relationships_v2`, `timeline_events`) created with RLS and indexing.
- ✅ Context views (`parts_display`, `timeline_display`) and `user_context_cache` materialized view implemented.
- ✅ Typed data-access layer scaffolded under `lib/data/schema` for server usage.
- 🔜 Migrate legacy markdown data and wire Mastra tools to the new interfaces (tracked in follow-on beads).

### Phase 2: Context System (Week 2-3)

- Materialized views
- Context loading
- Summarization pipeline
- Background workers

### Phase 3: UI Integration (Week 3-4)

- Parts list view
- Timeline view
- Part detail pages
- Real-time updates

### Phase 4: Intelligence Layer (Week 4-5)

- Smart querying
- Pattern detection
- Relationship discovery
- Progress tracking

## Success Metrics

### Technical Metrics

- Query response time < 100ms (p95)
- Context load time < 200ms
- Session creation time < 50ms
- Zero data loss incidents

### User Experience Metrics

- Parts discovered per session
- Time to first part naming
- Session engagement duration
- Follow-up completion rate

### Therapeutic Metrics

- Part integration progress
- Relationship insights discovered
- Breakthrough moments captured
- Pattern recognition accuracy

## Migration Strategy

For existing systems with markdown-based storage:

1. **Parallel Run**: Keep markdown system running while building new system
2. **Data Import**: Migrate existing parts and observations to database
3. **Gradual Cutover**: Route read traffic to new system first, then writes
4. **Cleanup**: Remove markdown system once stable

## Conclusion

This architecture provides a robust foundation for an IFS therapy application that:

1. **Captures the nuance** of therapeutic work through flexible observations
2. **Maintains performance** through smart indexing and caching
3. **Supports natural discovery** through progressive part emergence
4. **Enables intelligence** through context-aware agent tools
5. **Scales gracefully** through materialized views and background processing

The system balances the needs of therapist-style note-taking with the requirements of a responsive UI and intelligent agent, creating a powerful tool for IFS therapy practice.
