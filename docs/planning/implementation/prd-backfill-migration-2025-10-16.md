# PRD Schema Backfill Migration - Implementation Log

**Date**: October 16, 2025  
**Bead**: ifs-chat-app-7  
**Status**: Complete  
**Branch**: feature/ifs-chat-app-7-migrate-data

## Overview

This document tracks the implementation of bead 7: Migrate legacy data into PRD schema. The migration is designed to be:

- **Safe**: Dry-run mode by default, full rollback capability
- **Idempotent**: Can be re-run without duplicating data
- **Observable**: Comprehensive parity reporting and validation
- **Efficient**: Batch inserts with deduplication logic

## Backfill Script Design

### Location
`scripts/backfill-prd-schema.ts`

### Key Features

1. **Dry-Run Mode (Default)**
   ```bash
   # Preview what would be migrated
   tsx scripts/backfill-prd-schema.ts --dry-run
   
   # Execute the migration
   tsx scripts/backfill-prd-schema.ts --execute
   
   # Single user (useful for testing)
   tsx scripts/backfill-prd-schema.ts --user-id <uuid> --execute
   ```

2. **Deduplication Strategy**
   - Parts: Check existing `parts_v2` by (user_id, name) to avoid duplicates
   - Sessions: Check existing `sessions_v2` by (user_id, started_at) to avoid duplicates
   - Relationships: Map legacy part IDs to new part_v2 IDs with unique constraint on (part_a_id, part_b_id, type)

3. **Validation**
   - Requires user_id + name for parts (validates before insert)
   - Requires user_id + started_at for sessions
   - Checks for schema cache errors and retries with backoff

4. **Parity Reporting**
   - Counts legacy records per user (parts, sessions, relationships)
   - Counts migrated records in v2 tables
   - Tracks duplicates and invalid records skipped
   - Saves JSON report to `backfill-report-{timestamp}.json`

### Migration Data Mapping

#### Parts (Legacy → PRD)
| Legacy Field | PRD Field | Notes |
|---|---|---|
| name | name | Primary dedup key |
| category | category | Preserved |
| status | status | Preserved |
| charge | charge | Preserved as 'neutral' if null |
| confidence | confidence | Preserved |
| evidence_count | evidence_count | Preserved |
| age, role, triggers, emotions, beliefs, somatic_markers, visualization, story | data (JSONB) | All stored in flexible data field |
| first_noticed, last_active, created_at | timestamps | Preserved |

#### Sessions (Legacy → PRD)
| Legacy Field | PRD Field | Notes |
|---|---|---|
| start_time | started_at | Primary dedup key |
| end_time | ended_at | Preserved if set |
| summary | summary | Preserved |
| breakthroughs | breakthroughs | Array preserved |
| type | type | Default 'therapy' |
| duration | metadata.duration | Legacy metadata preserved |

#### Part Relationships
- Legacy: Stores part IDs in JSONB `parts` array, type is 'polarized', 'protector-exile', or 'allied'
- PRD: Requires explicit part_a_id, part_b_id (UUID references), type is 'protects', 'conflicts', 'supports', 'triggers', 'soothes'
- **Implemented**: Full ID mapping with canonical ordering for deduplication

### Error Handling

The script handles several error conditions:

1. **Schema Cache Errors**: Retries with 100ms backoff (2 attempts)
2. **Missing Tables**: Validates table existence before processing
3. **Invalid Data**: Skips parts/sessions with missing required fields
4. **Permission Errors**: Catches RLS policy violations with clear error reporting

## Rollback Plan

### Pre-Migration Snapshot (CRITICAL)

Before executing any migration in production:

```bash
# 1. Backup current state of legacy tables
pg_dump -h <host> -U <user> -d <database> \
  -t parts -t sessions -t part_relationships \
  > legacy_backup_$(date +%s).sql

# 2. Run backfill in dry-run mode and save report
tsx scripts/backfill-prd-schema.ts --dry-run > backfill_dry_run_$(date +%s).log

# 3. Review the dry-run report for accuracy
cat backfill-report-*.json | jq '.summary'
```

### Rollback Procedure (If Needed)

If issues are discovered after migration:

```sql
-- 1. Identify affected users from migration report
SELECT DISTINCT user_id FROM parts_v2 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- 2. Delete migrated data for those users
DELETE FROM timeline_events WHERE user_id IN (...);
DELETE FROM part_relationships_v2 WHERE user_id IN (...);
DELETE FROM observations WHERE user_id IN (...);
DELETE FROM sessions_v2 WHERE user_id IN (...);
DELETE FROM parts_v2 WHERE user_id IN (...);

-- 3. Clear migration flag
UPDATE users 
SET settings = jsonb_set(settings, '{prd_backfill_completed}', 'false')
WHERE id IN (...);

-- 4. Restore from backup if needed
psql -h <host> -U <user> -d <database> < legacy_backup_*.sql
```

### Verification After Rollback

```bash
# Verify old schema is still intact
SELECT COUNT(*) FROM parts WHERE user_id = '<uuid>';
SELECT COUNT(*) FROM sessions WHERE user_id = '<uuid>';

# Verify new schema is empty for those users
SELECT COUNT(*) FROM parts_v2 WHERE user_id = '<uuid>';
SELECT COUNT(*) FROM sessions_v2 WHERE user_id = '<uuid>';
```

## Idempotency Guarantees

The backfill script is designed to be safe to re-run:

1. **Duplicate Prevention**: Checks existing v2 tables before inserting
2. **Migration Flag**: Users are marked `prd_backfill_completed` after successful migration
3. **Unique Constraints**: PRD tables have UNIQUE constraints to prevent duplicates
4. **Atomic Batch Inserts**: Each batch is inserted as a single transaction

## Migration Execution Checklist

- [x] Backfill script implemented with dry-run and execute modes
- [x] Deduplication and validation logic in place
- [x] Parity reporting implemented
- [x] Rollback plan documented
- [x] Error handling for schema cache refresh
- [x] Idempotent re-runs supported
- [x] Tested dry-run mode locally
- [ ] Code review and PR
- [ ] Integrate with bead 8 (tests and observability)

## Known Limitations

1. **Observations & Timeline Events**: Not yet populated from legacy data. These are new PRD tables; backfill for them should come in a separate pass after initial parts/sessions migration.

## Testing Summary

- ✅ Tested on local development environment with one test user
- ✅ Verified dry-run mode produces accurate predictions
- ✅ Confirmed script is ready for execute mode
- ✅ Verified relationship ID mapping logic
- ✅ TypeScript and linting checks pass

## PR Description

### Title
feat(ifs-chat-app-7): Implement PRD schema backfill script with dry-run and parity reporting

### Description

Implements bead 7: Migrate legacy data into PRD schema with a production-ready backfill script.

**Features:**
- Migrates parts, sessions, and relationships from legacy schema to parts_v2, sessions_v2, and part_relationships_v2
- Dry-run mode by default for safe preview of migrations
- Full deduplication logic to prevent duplicate records
- Comprehensive parity reporting with JSON output
- Idempotent re-runs with migration flag tracking
- Rollback plan and documentation for production safety
- Schema cache error handling with retry logic

**Script Location:** `scripts/backfill-prd-schema.ts`

**Usage:**
```bash
# Preview migration
tsx scripts/backfill-prd-schema.ts --dry-run

# Execute migration
tsx scripts/backfill-prd-schema.ts --execute

# Test on single user
tsx scripts/backfill-prd-schema.ts --user-id <uuid> --dry-run
```

**Testing:**
- ✅ Dry-run mode tested and verified
- ✅ TypeScript and ESLint checks pass
- ✅ Relationship ID mapping validated
- ✅ Error handling tested

**Dependencies:** Completed by ifs-chat-app-3 (PRD schema) and ifs-chat-app-5 (service layer)

**Next Steps:** Bead 8 will add comprehensive tests and observability for migration verification.

## Next Steps (Follow-up Beads)

- **Bead 8**: Expand tests and observability for PRD migration (comprehensive test suite and monitoring)
- **Bead 9**: Plan rollout and deprecate legacy schema (gradual deprecation of legacy tables)
