# Data Model

This document describes the core database entities and their relationships in Trailhead.

## Core Entities

### Users

Authentication and user profile management.

```sql
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ,
  settings JSONB,
  -- Supabase Auth integration
)
```

**RLS**: Users can only access their own records.

### Sessions

Chat conversation sessions.

```sql
sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title TEXT,
  status TEXT, -- 'active', 'ended'
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  metadata JSONB
)
```

**RLS**: `user_id = auth.uid()`

### Messages

Individual messages within sessions.

```sql
messages (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  user_id UUID REFERENCES users(id),
  role TEXT, -- 'user', 'assistant', 'system'
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
```

**RLS**: `user_id = auth.uid()`

### Parts

Internal Family Systems parts tracked for each user.

```sql
parts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name TEXT,
  story TEXT,
  status TEXT, -- 'emerging', 'acknowledged', 'active', 'integrated'
  confidence_score FLOAT,
  recent_evidence JSONB[], -- capped at 10 items
  attributes JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Key Fields**:
- `status` - Lifecycle stage of the part
- `confidence_score` - Evidence strength (0.0 to 1.0)
- `recent_evidence` - Array of recent citations from user language

**RLS**: `user_id = auth.uid()`

### Part Relationships

Connections between parts.

```sql
part_relationships (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  from_part_id UUID REFERENCES parts(id),
  to_part_id UUID REFERENCES parts(id),
  relationship_type TEXT, -- 'protector-exile', 'polarized', 'allied'
  polarization_level INT, -- 0-10 scale
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**RLS**: `user_id = auth.uid()`

### Part Assessments

Evaluations and observations about parts.

```sql
part_assessments (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  part_id UUID REFERENCES parts(id),
  assessment_type TEXT,
  content JSONB,
  created_at TIMESTAMPTZ
)
```

**RLS**: `user_id = auth.uid()`

### Agent Actions

Audit log of all agent-driven database mutations.

```sql
agent_actions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  session_id UUID REFERENCES sessions(id),
  action_type TEXT, -- 'create_part', 'update_part', 'create_relationship', etc.
  entity_type TEXT,
  entity_id UUID,
  payload JSONB,
  result JSONB,
  reverted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
```

**Purpose**: Complete audit trail enabling rollback/undo functionality.

**RLS**: `user_id = auth.uid()`

### User Memory Snapshots

Differential memory system.

```sql
user_memory_snapshots (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  version INT,
  is_checkpoint BOOLEAN,
  operations JSONB, -- JSON Patch (RFC 6902)
  metadata JSONB,
  created_at TIMESTAMPTZ
)
```

**Key Concepts**:
- **Differential**: Store JSON Patch diffs between versions
- **Checkpoints**: Full snapshot every N versions (default: 50)
- **Reconstruction**: Apply patches forward from last checkpoint

**RLS**: `user_id = auth.uid()`

### Memory Updates Queue

Event-driven queue for memory processing.

```sql
memory_updates (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  kind TEXT, -- 'session', 'check_in', 'insight'
  ref_id UUID, -- ID of the referenced entity
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  UNIQUE(user_id, kind, ref_id) -- Idempotency
)
```

**Purpose**: Tracks pending updates for background memory pipeline.

**RLS**: `user_id = auth.uid()`

### Insights

AI-generated reflections and patterns.

```sql
insights (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type TEXT, -- 'session_summary', 'nudge', 'follow_up', 'observation'
  status TEXT, -- 'pending', 'revealed', 'actioned'
  content JSONB,
  rating JSONB,
  feedback TEXT,
  revealed_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**RLS**: `user_id = auth.uid()`

### Onboarding

User onboarding flow tracking.

```sql
onboarding (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  current_step INT,
  completed BOOLEAN DEFAULT FALSE,
  responses JSONB,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
```

**RLS**: `user_id = auth.uid()`

## Relationships Diagram

```
users
  ├── sessions
  │     └── messages
  ├── parts
  │     ├── part_relationships (from/to)
  │     └── part_assessments
  ├── agent_actions
  ├── user_memory_snapshots
  ├── memory_updates
  ├── insights
  └── onboarding
```

## Indexes

Key indexes for query performance:

```sql
-- Sessions
CREATE INDEX idx_sessions_user_status ON sessions(user_id, status);
CREATE INDEX idx_sessions_user_started ON sessions(user_id, started_at DESC);

-- Messages
CREATE INDEX idx_messages_session ON messages(session_id, created_at);

-- Parts
CREATE INDEX idx_parts_user_status ON parts(user_id, status);

-- Part Relationships
CREATE INDEX idx_relationships_from ON part_relationships(from_part_id);
CREATE INDEX idx_relationships_to ON part_relationships(to_part_id);

-- Agent Actions
CREATE INDEX idx_actions_user_created ON agent_actions(user_id, created_at DESC);
CREATE INDEX idx_actions_entity ON agent_actions(entity_type, entity_id);

-- Memory Snapshots
CREATE INDEX idx_memory_user_version ON user_memory_snapshots(user_id, version DESC);

-- Memory Updates
CREATE INDEX idx_memory_updates_user_processed ON memory_updates(user_id, processed, created_at);

-- Insights
CREATE INDEX idx_insights_user_status ON insights(user_id, status);
CREATE INDEX idx_insights_user_status_created ON insights(user_id, status, created_at DESC);
```

## Row Level Security (RLS)

All tables enforce strict RLS policies:

```sql
-- Example policy structure
CREATE POLICY "Users can only access their own data"
  ON table_name
  FOR ALL
  USING (user_id = auth.uid());
```

This ensures complete data isolation between users at the database level.

## Related Documentation

- [Architecture Overview](./overview.md)
- [User Memory System](../user-memory.md)
- [Current State Architecture](../current_state/01_system_architecture.md)
