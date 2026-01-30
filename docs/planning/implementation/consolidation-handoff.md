# Memory & Parts Consolidation - Agent Handoff Plan

## Current Status

**Memory System Cleanup: COMPLETE** ✅

- All broken memory functions deleted from `service.ts`
- All unused memory infrastructure deleted (`snapshots/`, `markdown/`, `queue.ts`, etc.)
- All cascading import errors fixed
- Typecheck passes (only 1 pre-existing error in untracked `GoDeeperCard.tsx`)

**Parts Data Layer Consolidation: NOT STARTED** ⏳

---

## Remaining Work: Parts Data Layer Consolidation

### Goal

Migrate from 4 fragmented parts modules to a clean V2-only structure:

**Current Structure (messy):**

```
lib/data/
├── parts.schema.ts        # Old Zod schemas with PartRow type
├── parts-lite.ts          # Client functions using views + mappers
├── parts-server.ts        # Server functions
└── schema/
    ├── parts.ts           # V2 schemas
    ├── parts-agent.ts     # Agent-facing (995 lines!)
    ├── legacy-mappers.ts  # V1↔V2 conversion (~180 lines)
    └── types.ts           # V2 types (PartRowV2)
```

**Target Structure (clean):**

```
lib/data/
├── parts/
│   ├── schema.ts          # Single Zod schema file (V2 only)
│   ├── client.ts          # Client-safe functions
│   ├── server.ts          # Server-only functions
│   └── agent.ts           # Agent-facing functions (streamlined)
└── schema/
    └── types.ts           # Shared types (keep as-is)
```

---

## Task Breakdown for Parallel Execution

### WAVE 1: Scaffolding (3 parallel tasks, no dependencies)

#### Task B1: Create directory structure

**Agent type:** executor
**Files to create:**

- `lib/data/parts/index.ts` (barrel export)
- `lib/data/parts/schema.ts` (empty, will be populated by B2)
- `lib/data/parts/client.ts` (empty, will be populated by B4)
- `lib/data/parts/server.ts` (empty, will be populated by B4)
- `lib/data/parts/agent.ts` (empty, will be populated by B3)

**Acceptance criteria:** Directory exists with empty stub files that export `{}` or have TODO comments.

---

#### Task B2: Migrate schemas to V2-only

**Agent type:** executor
**Input files:**

- `lib/data/parts.schema.ts` (current)
- `lib/data/schema/parts.ts` (V2 schemas)
- `lib/data/schema/types.ts` (V2 types)

**Output file:** `lib/data/parts/schema.ts`

**Instructions:**

1.  Read `lib/data/parts.schema.ts` and identify which schemas are still needed
2.  Read `lib/data/schema/parts.ts` for V2 schema definitions
3.  Create `lib/data/parts/schema.ts` with:
    - All Zod schemas using `PartRowV2` types only
    - Remove any references to old `PartRow` type
    - Keep: `searchPartsSchema`, `getPartByIdSchema`, `createEmergingPartSchema`, etc.
    - Export all schemas
4.  DO NOT delete old files yet (that's B6)

**Acceptance criteria:** New schema.ts compiles, exports all needed schemas.

---

#### Task B3: Simplify parts-agent.ts

**Agent type:** executor  
 **Input file:** `lib/data/schema/parts-agent.ts` (995 lines)

**Instructions:**

1.  Read the file and identify:
    - Functions that call `mapPartRowFromV2()` - these need updating
    - Imports from `./legacy-mappers` - these need removing
    - Imports from `@/lib/memory/read` - already removed, verify no dead code
2.  For each function using `mapPartRowFromV2()`:
    - Change to work directly with `PartRowV2` instead
    - Remove the mapping call
3.  Remove unused imports
4.  The goal is to reduce this file significantly and remove V1 dependencies

**Acceptance criteria:**

- No imports from `./legacy-mappers`
- No calls to `mapPartRowFromV2()`
- File still compiles

---

### WAVE 2: Consolidation (1 task, depends on B1 + B2)

#### Task B4: Merge parts-lite + parts-server

**Agent type:** executor
**Depends on:** B1 (directory exists), B2 (schemas exist)

**Input files:**

- `lib/data/parts-lite.ts` (~348 lines) - client-safe functions
- `lib/data/parts-server.ts` (~120 lines) - server-only functions

**Output files:**

- `lib/data/parts/client.ts` - client-safe functions
- `lib/data/parts/server.ts` - server-only functions

**Instructions:**

1.  Read `parts-lite.ts` - these are client-safe functions that use browser Supabase client
2.  Read `parts-server.ts` - these use admin client for server-side operations
3.  Move functions to appropriate new files:
    - Client functions → `lib/data/parts/client.ts`
    - Server functions → `lib/data/parts/server.ts`
4.  Update imports to use new schema location (`./schema` or `../schema/types`)
5.  Remove any `mapPartRowFromV2` calls - work directly with V2 types
6.  Update barrel export in `lib/data/parts/index.ts`

**Acceptance criteria:**

- Both new files compile
- All functions from original files are accounted for
- No V1 type references

---

### WAVE 3: Import Migration (1 task, depends on B4)

#### Task B5: Update imports across codebase

**Agent type:** executor
**Depends on:** B4 (new modules exist)

**Instructions:**

1.  Find all files importing from old locations:

    ```bash
    rg "from ['\"]@/lib/data/parts-lite" -l
    rg "from ['\"]@/lib/data/parts-server" -l
    rg "from ['\"]@/lib/data/parts.schema" -l
    rg "from ['\"]@/lib/data/schema/legacy-mappers" -l
    ```

2.  For each file, update imports:
    - `@/lib/data/parts-lite` → `@/lib/data/parts/client` or `@/lib/data/parts`
    - `@/lib/data/parts-server` → `@/lib/data/parts/server` or `@/lib/data/parts`
    - `@/lib/data/parts.schema` → `@/lib/data/parts/schema` or `@/lib/data/parts`
    - `@/lib/data/schema/legacy-mappers` → remove (no longer needed)

3.  Update any code that uses `PartRow` to use `PartRowV2`

4.  Run `npm run typecheck` after each batch of files

**Acceptance criteria:**

- No imports from old locations
- Typecheck passes

---

### WAVE 4: Cleanup (1 task, depends on B5)

#### Task B6: Delete legacy files

**Agent type:** executor
**Depends on:** B5 (all imports updated)

**Files to delete:**

- `lib/data/parts.schema.ts`
- `lib/data/parts-lite.ts`
- `lib/data/parts-server.ts`
- `lib/data/schema/legacy-mappers.ts`
- `lib/data/schema/parts.ts` (if fully migrated to parts/schema.ts)

**Instructions:**

1.  Run `npm run typecheck` first to verify no remaining references
2.  Delete each file
3.  Run `npm run typecheck` again to verify nothing broke
4.  Run `npm run lint` to check for issues

**Acceptance criteria:**

- All legacy files deleted
- Typecheck passes
- Lint passes (warnings OK, no errors)

---

### WAVE 5: Final Verification

#### Task B7: Commit and verify

**Agent type:** main agent (not parallelizable)

**Instructions:**

1.  Run full verification:
    ```bash
    npm run typecheck
    npm run lint
    npm run test -- --passWithNoTests
    ```
2.  Review all changes with `git diff --stat`
3.  Commit with message:

    ```
    refactor: consolidate parts data layer to V2-only structure

    - Create lib/data/parts/ directory with clean module structure
    - Migrate all schemas to V2-only (remove PartRow legacy type)
    - Consolidate parts-lite.ts and parts-server.ts into parts/client.ts and parts/server.ts
    - Simplify parts-agent.ts (remove legacy mapper calls)
    - Delete legacy-mappers.ts and old parts modules

    Net reduction: ~1,000 lines
    ```

---

## Dependency Graph

```
       ┌─────┐     ┌─────┐     ┌─────┐
       │ B1  │     │ B2  │     │ B3  │   ← WAVE 1 (parallel)
       └──┬──┘     └──┬──┘     └──┬──┘
          │          │           │
          └────┬─────┘           │
               ▼                 │
            ┌─────┐              │
            │ B4  │ ←────────────┘   ← WAVE 2
            └──┬──┘
               │
               ▼
            ┌─────┐
            │ B5  │                   ← WAVE 3
            └──┬──┘
               │
               ▼
            ┌─────┐
            │ B6  │                   ← WAVE 4
            └──┬──┘
               │
               ▼
            ┌─────┐
            │ B7  │                   ← WAVE 5 (commit)
            └─────┘
```

---

## Files Reference

### Files to READ (input)

- `lib/data/parts.schema.ts` - old schemas
- `lib/data/parts-lite.ts` - client functions
- `lib/data/parts-server.ts` - server functions
- `lib/data/schema/parts.ts` - V2 schemas
- `lib/data/schema/parts-agent.ts` - agent functions
- `lib/data/schema/legacy-mappers.ts` - mapping functions
- `lib/data/schema/types.ts` - V2 types

### Files to CREATE

- `lib/data/parts/index.ts`
- `lib/data/parts/schema.ts`
- `lib/data/parts/client.ts`
- `lib/data/parts/server.ts`
- `lib/data/parts/agent.ts`

### Files to DELETE (after migration)

- `lib/data/parts.schema.ts`
- `lib/data/parts-lite.ts`
- `lib/data/parts-server.ts`
- `lib/data/schema/legacy-mappers.ts`
- `lib/data/schema/parts.ts`

### Files to MODIFY (import updates, ~30-40 files)

Run these commands to find them:

```bash
rg "from ['\"]@/lib/data/parts-lite" -l
rg "from ['\"]@/lib/data/parts-server" -l
rg "from ['\"]@/lib/data/parts.schema" -l
rg "from ['\"]@/lib/data/schema/legacy-mappers" -l
rg "mapPartRowFromV2" -l
rg "PartRow[^V]" -g "*.ts" -g "*.tsx" -l
```
