# Parts Tools Reference (Conversational Agent)

## Tool Categories

### 🔍 Discovery & Query (3 tools)

| Tool | Purpose | Returns |
|------|---------|---------|
| `get_parts_metadata_summary` | Overview of all metadata | Tag list, category/status counts, activity stats |
| `list_parts` | List all parts with basic filtering | Minimal metadata (id, name, emoji, category, status, tags) |
| `query_parts` | Advanced filtering (date ranges, tag logic, name search) | Same as list_parts |

**Use when:** Agent needs to find parts by name, category, tags, or activity

**Why `get_parts_metadata_summary` matters:**
Without this tool, the agent has no visibility into:
- What tags exist (can't suggest valid tags for queries)
- What categories are in use (can't guide user to valid options)
- How many parts exist (can't set user expectations)
- What the data landscape looks like (querying blind)

With this tool, the agent can:
- Answer "what tags do I have?" directly
- Validate queries before executing ("no parts have that tag")
- Provide context ("you have 5 active managers and 2 archived")
- Guide users to valid query options

---

### 📖 Read Operations (1 tool)

| Tool | Purpose | Returns |
|------|---------|---------|
| `read_part` | Get full part data | Metadata (read-only context) + Content sections (editable) |

**Use when:** Agent needs full context before making changes or answering questions

---

### ✍️ Create Operations (1 tool)

| Tool | Purpose | Updates |
|------|---------|---------|
| `create_part` | Create new part | Minimal YAML (name, emoji, category, tags) + optional initial content |

**Use when:** User wants to create a new part

---

### 🏷️ Metadata Updates (1 tool)

| Tool | Purpose | Updates |
|------|---------|---------|
| `update_part_metadata` | Update YAML frontmatter | name, emoji, category, status, tags |

**Use when:** User explicitly requests metadata changes:
- "Tag this part with X"
- "Change category to manager"
- "Archive this part"
- "Rename this part"

**Important:** For tags, read current state first and merge (tool replaces entire array)

---

### 📝 Content Updates (4 tools)

| Tool | Purpose | Updates |
|------|---------|---------|
| `update_part_content` | Modify a section | Append, prepend, or replace content in one section |
| `search_part_sections` | Find text in sections | Returns matches with line numbers |
| `replace_in_part_section` | Find and replace text | Regex-based replacement in one section |
| `batch_update_part_content` | Multiple section updates | Atomic multi-section updates |

**Use when:** User wants to update narrative content (role, evidence, notes, session log)

---

## Tool Selection Guide

### User says: "What tags do I have?"
→ `get_parts_metadata_summary()` then return tags.all_tags

### User says: "How many parts do I have?"
→ `get_parts_metadata_summary()` then return summary.total_parts and breakdown

### User says: "Show me all my manager parts"
→ `list_parts({ category: 'manager', status: 'active' })`

### User says: "Find parts with 'anxiety' tag from last month"
→ `query_parts({ filters: { tags_any: ['anxiety'], last_active_after: '2024-09-11' } })`

### User says: "Tell me about my Inner Critic"
→ `list_parts({ name_contains: 'critic' })` then `read_part({ partId })`

### User says: "Tag the Protector with 'boundaries'"
→ `read_part({ partId })` then `update_part_metadata({ partId, updates: { tags: [...existingTags, 'boundaries'] } })`

### User says: "Add this observation to the Critic's evidence"
→ `update_part_content({ partId, section: '## Evidence & Observations', operation: 'append', content: '- ...' })`

### User says: "Change the Perfectionist to a Manager"
→ `update_part_metadata({ partId, updates: { category: 'manager' } })`

### User says: "Archive inactive parts"
→ `list_parts({ ... })` then loop: `update_part_metadata({ partId, updates: { status: 'archived' } })`

---

## Orchestration Patterns

### Pattern 1: Tag Addition (Read-Modify-Write)
```typescript
// User: "Add 'anxiety' tag to Inner Critic"

// 1. Find
const { parts } = await list_parts({ name_contains: 'critic' });

// 2. Read current state
const { metadata } = await read_part({ partId: parts[0].id });

// 3. Merge
const newTags = [...metadata.tags, 'anxiety'];

// 4. Write
await update_part_metadata({
  partId: parts[0].id,
  updates: { tags: newTags }
});
```

### Pattern 2: Bulk Metadata + Content Update
```typescript
// User: "Archive the Perfectionist and add a closing note"

await batch_update_part_content({
  partId,
  updates: [
    { section: '## Session Log', operation: 'append', content: '### Archived\nPart no longer active as of 2025-10-11' }
  ]
});

await update_part_metadata({
  partId,
  updates: { status: 'archived' }
});
```

### Pattern 3: Search and Update Content
```typescript
// User: "Replace 'protects me' with 'keeps me safe' in all parts"

// 1. Find all parts
const { parts } = await list_parts({ status: 'all' });

// 2. For each part
for (const part of parts) {
  // Search for the phrase
  const { matches } = await search_part_sections({
    partId: part.id,
    query: 'protects me'
  });
  
  // If found, replace in each section
  for (const match of matches) {
    await replace_in_part_section({
      partId: part.id,
      section: match.section,
      search: 'protects me',
      replace: 'keeps me safe'
    });
  }
}
```

---

## Division of Labor

### Conversational Agent (These Tools)
✅ Discovery and reading  
✅ Direct user-requested metadata changes  
✅ All narrative content updates  
✅ Orchestrating multi-step operations  

### Metadata Agent (Future - uses same update_part_metadata tool)
✅ Inferring tags from conversations  
✅ Detecting relationships automatically  
✅ Computing activity metrics  
✅ Suggesting category reclassification  

**Key insight:** Same tool, different triggers. Conversational agent responds to direct user commands. Metadata agent runs inference and suggests/auto-applies updates.

---

## Tool Count: 10 Total

| Category | Count | Tools |
|----------|-------|-------|
| Discovery | 3 | get_parts_metadata_summary, list_parts, query_parts |
| Read | 1 | read_part |
| Create | 1 | create_part |
| Metadata | 1 | update_part_metadata |
| Content | 4 | update_part_content, search_part_sections, replace_in_part_section, batch_update_part_content |

**Design:** MECE (Mutually Exclusive, Collectively Exhaustive) CRUD operations with minimal orchestration logic in tools. Agent orchestrates workflows.
