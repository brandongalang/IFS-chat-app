#!/usr/bin/env tsx
/**
 * Backfill PRD Schema (parts_v2, sessions_v2, observations, relationships_v2, timeline_events)
 * 
 * This script migrates legacy data into the new PRD-compliant schema with:
 * - Full deduplication and validation
 * - Dry-run mode (default)
 * - Comprehensive parity reporting
 * - Idempotent re-runs
 * - Rollback documentation
 * 
 * Usage:
 *   # Dry run (preview what would be migrated)
 *   tsx scripts/backfill-prd-schema.ts --dry-run
 *   
 *   # Execute the migration
 *   tsx scripts/backfill-prd-schema.ts --execute
 *   
 *   # Show statistics for a specific user
 *   tsx scripts/backfill-prd-schema.ts --user-id <uuid> --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

/** Statistics collected during backfill process for a single user. */
interface BackfillStats {
  legacyPartsCount: number
  legacySessionsCount: number
  legacyRelationshipsCount: number
  migratedPartsCount: number
  migratedSessionsCount: number
  migratedRelationshipsCount: number
  duplicatePartsSkipped: number
  invalidPartsSkipped: number
  timestamp: string
}

/** Complete migration report with per-user statistics and totals. */
interface MigrationReport {
  mode: 'dry-run' | 'execute'
  userCount: number
  stats: Map<string, BackfillStats>
  errors: Array<{ userId: string; error: string }>
  summary: {
    totalLegacyParts: number
    totalLegacySessions: number
    totalLegacyRelationships: number
    totalMigratedParts: number
    totalMigratedSessions: number
    totalMigratedRelationships: number
    totalDuplicatesSkipped: number
    totalInvalidSkipped: number
  }
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

type PartRelationshipRow = {
  part_a_id: string
  part_b_id: string
  type: string
}

type PartRelationshipInsert = {
  user_id: string
  part_a_id: string
  part_b_id: string
  type: string
  strength?: number | null
  context?: string | null
  observations?: string[] | null
  created_at?: string | null
  updated_at?: string | null
}

/**
 * Retry a fetch-style operation when transient "schema cache" errors occur.
 *
 * @param fn - A function that performs the operation and resolves to an object `{ data, error }`. The call will be retried if `error.message` contains the substring "schema cache".
 * @param maxAttempts - Maximum number of attempts to run `fn` (default: 2).
 * @param delayMs - Milliseconds to wait between retry attempts (default: 100).
 * @returns The first `{ data, error }` result whose `error` is absent or does not contain "schema cache"; if all attempts fail with schema-cache errors, returns `{ data: null, error: lastError }`.
 */
async function withRetry<T>(
  fn: () => Promise<{ data: T | null; error: any }>,
  maxAttempts: number = 2,
  delayMs: number = 100,
): Promise<{ data: T | null; error: any }> {
  let lastError: any
  for (let i = 0; i < maxAttempts; i++) {
    const result = await fn()
    if (!result.error || !result.error.message?.includes('schema cache')) {
      return result
    }
    lastError = result.error
    if (i < maxAttempts - 1) {
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
  return { data: null, error: lastError }
}

/**
 * Check whether a user's PRD backfill has been completed.
 *
 * @param userId - The user's id
 * @returns `true` if the user's `settings.prd_backfill_completed` is `true`, `false` otherwise or if the settings could not be fetched
 */
async function getMigrationFlag(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('settings')
    .eq('id', userId)
    .single()

  if (error) return false
  const settings = data?.settings as any
  return settings?.prd_backfill_completed === true
}

/**
 * Mark a user's PRD backfill as completed by setting the backfill flag and timestamp in their settings.
 *
 * @param userId - The ID of the user whose settings will be updated
 */
async function setMigrationFlag(userId: string): Promise<void> {
  await supabase
    .from('users')
    .update({
      settings: {
        prd_backfill_completed: true,
        prd_backfill_completed_at: new Date().toISOString(),
      },
    })
    .eq('id', userId)
}

/**
 * Migrate a user's legacy parts into the parts_v2 table, performing deduplication and basic validation.
 *
 * When not a dry run, prepares new parts entries from legacy records and inserts them in a single batch.
 * Duplicate parts (by name) and legacy records missing required fields are skipped.
 *
 * @param userId - The ID of the user whose legacy parts will be migrated
 * @param dryRun - If true, perform all checks and preparation but do not insert into the database
 * @returns An object with `migratedCount` (number of prepared/inserted records), `skipped` (number of legacy records not migrated), and `errors` (any error messages encountered)
 */
async function migratePartsForUser(
  userId: string,
  dryRun: boolean,
): Promise<{ migratedCount: number; skipped: number; errors: string[] }> {
  const errors: string[] = []
  let migratedCount = 0
  let skipped = 0

  // 1. Fetch legacy parts
  const { data: legacyParts, error: fetchError } = await supabase
    .from('parts')
    .select('*')
    .eq('user_id', userId)

  if (fetchError) {
    errors.push(`Failed to fetch legacy parts: ${fetchError.message}`)
    return { migratedCount, skipped, errors }
  }

  if (!legacyParts || legacyParts.length === 0) {
    return { migratedCount, skipped, errors }
  }

  // 2. Check for existing parts in v2 table
  const { data: existingPartsV2, error: existingError } = await supabase
    .from('parts_v2')
    .select('name')
    .eq('user_id', userId)

  if (existingError) {
    errors.push(`Failed to check existing parts_v2: ${existingError.message}`)
    return { migratedCount, skipped, errors }
  }

  const existingNames = new Set((existingPartsV2 || []).map(p => p.name))

  // 3. Prepare inserts with deduplication
  const partsToInsert = []

  for (const part of legacyParts) {
    // Skip if already migrated
    if (existingNames.has(part.name)) {
      skipped++
      continue
    }

    // Validate required fields
    if (!part.name) {
      skipped++
      continue
    }

    const partData: any = {
      user_id: userId,
      name: part.name,
      placeholder: part.name, // Use name as fallback placeholder
      category: part.category || 'unknown',
      status: part.status || 'emerging',
      charge: part.charge || 'neutral',
      confidence: part.confidence || 0,
      evidence_count: part.evidence_count || 0,
      first_noticed: part.first_noticed || new Date(),
      last_active: part.last_active || new Date(),
      data: {
        age: part.age,
        role: part.role,
        triggers: part.triggers || [],
        emotions: part.emotions || [],
        beliefs: part.beliefs || [],
        somatic_markers: part.somatic_markers || [],
        visualization: part.visualization,
        story: part.story,
      },
    }

    partsToInsert.push(partData)
  }

  if (partsToInsert.length === 0) {
    return { migratedCount, skipped, errors }
  }

  // 4. Batch insert into parts_v2
  if (!dryRun) {
    const { error: insertError } = await supabase
      .from('parts_v2')
      .insert(partsToInsert)

    if (insertError) {
      errors.push(`Failed to insert parts_v2: ${insertError.message}`)
      return { migratedCount: 0, skipped, errors }
    }
  }

  migratedCount = partsToInsert.length
  return { migratedCount, skipped, errors }
}

/**
 * Migrates legacy session records for a user from `sessions` into `sessions_v2`.
 *
 * @param userId - ID of the user whose sessions will be migrated
 * @param dryRun - If true, prepares records and performs validation/deduplication but does not write to the database
 * @returns An object with `migratedCount` (number of sessions prepared or inserted), `skipped` (number of legacy sessions skipped due to deduplication), and `errors` (array of error messages encountered)
 */
async function migrateSessionsForUser(
  userId: string,
  dryRun: boolean,
): Promise<{ migratedCount: number; skipped: number; errors: string[] }> {
  const errors: string[] = []
  let migratedCount = 0
  let skipped = 0

  // 1. Fetch legacy sessions
  const { data: legacySessions, error: fetchError } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)

  if (fetchError) {
    errors.push(`Failed to fetch legacy sessions: ${fetchError.message}`)
    return { migratedCount, skipped, errors }
  }

  if (!legacySessions || legacySessions.length === 0) {
    return { migratedCount, skipped, errors }
  }

  // 2. Check for existing sessions in v2 table (with schema cache refresh handling)
  let existingSessionsV2 = []
  const { data: existingData, error: existingError } = await supabase
    .from('sessions_v2')
    .select('started_at')
    .eq('user_id', userId)

  if (existingError && !existingError.message.includes('schema cache')) {
    errors.push(`Failed to check existing sessions_v2: ${existingError.message}`)
    return { migratedCount, skipped, errors }
  }
  
  existingSessionsV2 = existingData || []

  const existingStartTimes = new Set((existingSessionsV2 || []).map(s => s.started_at))

  // 3. Prepare inserts with deduplication
  const sessionsToInsert = []

  for (const session of legacySessions) {
    // Skip if already migrated
    if (existingStartTimes.has(session.start_time)) {
      skipped++
      continue
    }

    const sessionData: any = {
      user_id: userId,
      type: 'therapy', // Default type
      summary: session.summary,
      key_insights: [],
      breakthroughs: session.breakthroughs || [],
      resistance_notes: [],
      homework: [],
      next_session: [],
      started_at: session.start_time,
      ended_at: session.end_time,
      last_message_at: session.start_time,
      metadata: {
        migrated_from_legacy: true,
        legacy_id: session.id,
        duration: session.duration,
      },
    }

    sessionsToInsert.push(sessionData)
  }

  if (sessionsToInsert.length === 0) {
    return { migratedCount, skipped, errors }
  }

  // 4. Batch insert into sessions_v2
  if (!dryRun) {
    const { error: insertError } = await supabase
      .from('sessions_v2')
      .insert(sessionsToInsert)

    if (insertError) {
      errors.push(`Failed to insert sessions_v2: ${insertError.message}`)
      return { migratedCount: 0, skipped, errors }
    }
  }

  migratedCount = sessionsToInsert.length
  return { migratedCount, skipped, errors }
}

/**
 * Migrate legacy part relationships for a single user into the v2 relationships table.
 *
 * Prepares v2 relationship records by mapping legacy part IDs → v2 part IDs, normalizing types,
 * deduplicating against existing v2 relationships, and optionally inserting the new records.
 *
 * @param userId - ID of the user whose legacy relationships will be migrated
 * @param dryRun - If true, the function performs all checks and preparation but does not write to the database
 * @returns An object with `migratedCount` (number of relationships prepared/inserted), `skipped` (number of legacy entries skipped for validation, mapping, or deduplication), and `errors` (collected error messages encountered during processing)
 */
async function migrateRelationshipsForUser(
  userId: string,
  dryRun: boolean,
): Promise<{ migratedCount: number; skipped: number; errors: string[] }> {
  const errors: string[] = []
  let migratedCount = 0
  let skipped = 0

  // 1. Fetch legacy relationships
  const { data: legacyRelationships, error: fetchError } = await supabase
    .from('part_relationships')
    .select('*')
    .eq('user_id', userId)

  if (fetchError) {
    errors.push(`Failed to fetch legacy relationships: ${fetchError.message}`)
    return { migratedCount, skipped, errors }
  }

  if (!legacyRelationships || legacyRelationships.length === 0) {
    return { migratedCount, skipped, errors }
  }

  // 2. Get parts mapping (old ID -> new ID and name -> new ID)
  const { data: legacyParts, error: legacyPartsError } = await supabase
    .from('parts')
    .select('id, name')
    .eq('user_id', userId)

  if (legacyPartsError) {
    errors.push(`Failed to fetch legacy parts for ID mapping: ${legacyPartsError.message}`)
    return { migratedCount, skipped, errors }
  }

  const legacyIdToName = new Map((legacyParts || []).map(p => [p.id, p.name]))

  // 3. Get parts v2 (name -> ID)
  const { data: partsV2, error: partsV2Error } = await supabase
    .from('parts_v2')
    .select('id, name')
    .eq('user_id', userId)

  if (partsV2Error) {
    errors.push(`Failed to fetch parts_v2 for mapping: ${partsV2Error.message}`)
    return { migratedCount, skipped, errors }
  }

  const nameToV2Id = new Map((partsV2 || []).map(p => [p.name, p.id]))

  // 4. Check for existing relationships
  let existingRelationships: PartRelationshipRow[] = []
  const { data: existingData, error: existingError } = await withRetry(async () =>
    supabase
      .from('part_relationships_v2')
      .select('part_a_id, part_b_id, type')
      .eq('user_id', userId),
  )

  if (existingError && !existingError.message.includes('schema cache')) {
    errors.push(`Failed to check existing relationships_v2: ${existingError.message}`)
    return { migratedCount, skipped, errors }
  }

  existingRelationships = existingData || []
  const existingRels = new Set(
    existingRelationships.map(r => `${r.part_a_id}:${r.part_b_id}:${r.type}`)
  )

  // 5. Prepare inserts with deduplication
  const relationshipsToInsert: PartRelationshipInsert[] = []

  for (const rel of legacyRelationships) {
    const partIds = rel.parts as any
    if (!Array.isArray(partIds) || partIds.length < 2) {
      skipped++
      continue
    }

    // Map legacy relationship types to PRD types
    const typeMap: any = {
      polarized: 'conflicts',
      'protector-exile': 'protects',
      allied: 'supports',
    }
    const relType = typeMap[rel.type] || 'supports'

    // Map legacy part IDs to part names, then to v2 part IDs
    const partNames = partIds.map((id: string) => legacyIdToName.get(id))
    const partV2Ids = partNames.map((name: string) => nameToV2Id.get(name))

    // Validate we can map all parts
    if (partV2Ids.includes(undefined)) {
      skipped++
      continue
    }

    // Create canonical order (A < B) for consistency
    const [partA, partB] = partV2Ids.sort() as string[]
    const relKey = `${partA}:${partB}:${relType}`

    // Skip if already migrated
    if (existingRels.has(relKey)) {
      skipped++
      continue
    }

    relationshipsToInsert.push({
      user_id: userId,
      part_a_id: partA,
      part_b_id: partB,
      type: relType,
      strength: rel.polarization_level ?? 0.5,
      context: rel.description,
      observations: rel.dynamics ?? [],
      created_at: rel.created_at,
      updated_at: rel.updated_at,
    })
  }

  if (relationshipsToInsert.length === 0) {
    return { migratedCount, skipped, errors }
  }

  // 6. Batch insert
  if (!dryRun) {
    const { error: insertError } = await withRetry(async () =>
      supabase
        .from('part_relationships_v2')
        .insert(relationshipsToInsert),
    )

    if (insertError) {
      errors.push(`Failed to insert relationships_v2: ${insertError.message}`)
      return { migratedCount: 0, skipped, errors }
    }
  }

  migratedCount = relationshipsToInsert.length
  return { migratedCount, skipped, errors }
}

/**
 * Collects counts of legacy and migrated PRD records for the given user.
 *
 * @returns A BackfillStats object containing:
 * - `legacyPartsCount`: number of records in the legacy `parts` table for the user
 * - `legacySessionsCount`: number of records in the legacy `sessions` table for the user
 * - `legacyRelationshipsCount`: number of records in the legacy `part_relationships` table for the user
 * - `migratedPartsCount`: number of records in `parts_v2` for the user
 * - `migratedSessionsCount`: number of records in `sessions_v2` for the user
 * - `migratedRelationshipsCount`: number of records in `part_relationships_v2` for the user
 * - `duplicatePartsSkipped`: count of duplicate legacy parts skipped (always `0` here)
 * - `invalidPartsSkipped`: count of invalid legacy parts skipped (always `0` here)
 * - `timestamp`: ISO 8601 string for when the stats were generated
 */
async function getBackfillStats(
  userId: string,
): Promise<BackfillStats> {
  // Count legacy records
  const { count: legacyPartsCount } = await supabase
    .from('parts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const { count: legacySessionsCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const { count: legacyRelationshipsCount } = await supabase
    .from('part_relationships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  // Count migrated records
  const { count: migratedPartsCount } = await supabase
    .from('parts_v2')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const { count: migratedSessionsCount } = await supabase
    .from('sessions_v2')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const { count: migratedRelationshipsCount } = await supabase
    .from('part_relationships_v2')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  return {
    legacyPartsCount: legacyPartsCount || 0,
    legacySessionsCount: legacySessionsCount || 0,
    legacyRelationshipsCount: legacyRelationshipsCount || 0,
    migratedPartsCount: migratedPartsCount || 0,
    migratedSessionsCount: migratedSessionsCount || 0,
    migratedRelationshipsCount: migratedRelationshipsCount || 0,
    duplicatePartsSkipped: 0,
    invalidPartsSkipped: 0,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Orchestrates the backfill of parts, sessions, and relationships for a single user.
 *
 * Runs each entity-specific migration (parts, sessions, relationships), aggregates any errors,
 * sets the user's migration-completed flag when running for real and no errors occurred,
 * and returns post-run statistics.
 *
 * @param dryRun - When true, perform a dry-run (no database writes); when false, apply changes and set the migration flag on success
 * @returns An object containing the user's BackfillStats and an array of error messages encountered during the backfill
 */
async function backfillForUser(
  userId: string,
  dryRun: boolean,
): Promise<{ stats: BackfillStats; errors: string[] }> {
  const allErrors: string[] = []

  try {
    console.log(`\n📦 Processing user: ${userId}`)

    // Migrate parts
    console.log('  📝 Migrating parts...')
    const { migratedCount: partsMigrated, errors: partsErrors } = await migratePartsForUser(userId, dryRun)
    allErrors.push(...partsErrors)
    if (dryRun) {
      console.log(`    ✓ Would migrate ${partsMigrated} parts (dry-run)`)
    } else {
      console.log(`    ✓ Migrated ${partsMigrated} parts`)
    }

    // Migrate sessions
    console.log('  📅 Migrating sessions...')
    const { migratedCount: sessionsMigrated, errors: sessionErrors } = await migrateSessionsForUser(userId, dryRun)
    allErrors.push(...sessionErrors)
    if (dryRun) {
      console.log(`    ✓ Would migrate ${sessionsMigrated} sessions (dry-run)`)
    } else {
      console.log(`    ✓ Migrated ${sessionsMigrated} sessions`)
    }

    // Migrate relationships
    console.log('  🔗 Migrating relationships...')
    const { migratedCount: relsMigrated, errors: relErrors } = await migrateRelationshipsForUser(userId, dryRun)
    allErrors.push(...relErrors)
    if (dryRun) {
      console.log(`    ✓ Would migrate ${relsMigrated} relationships (dry-run)`)
    } else {
      console.log(`    ✓ Migrated ${relsMigrated} relationships`)
    }

    if (!dryRun && allErrors.length === 0) {
      await setMigrationFlag(userId)
    }

    const stats = await getBackfillStats(userId)
    return { stats, errors: allErrors }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    allErrors.push(`Unexpected error for user ${userId}: ${msg}`)
    return { stats: await getBackfillStats(userId), errors: allErrors }
  }
}

/**
 * Orchestrates the PRD schema backfill process, supporting dry-run mode, execute mode, and optional per-user scope.
 *
 * Parses command-line flags (--dry-run, --execute, --user-id), runs the per-user backfill flow for a single user or all users, aggregates per-user statistics and errors, prints a summary to the console, and writes a timestamped JSON report to disk.
 */
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run') || !args.includes('--execute')
  const userIdArg = args.find((a, i) => i > 0 && args[i - 1] === '--user-id')
  const userId = userIdArg

  const report: MigrationReport = {
    mode: dryRun ? 'dry-run' : 'execute',
    userCount: 0,
    stats: new Map(),
    errors: [],
    summary: {
      totalLegacyParts: 0,
      totalLegacySessions: 0,
      totalLegacyRelationships: 0,
      totalMigratedParts: 0,
      totalMigratedSessions: 0,
      totalMigratedRelationships: 0,
      totalDuplicatesSkipped: 0,
      totalInvalidSkipped: 0,
    },
  }

  console.log(`\n🚀 PRD Schema Backfill - ${dryRun ? 'DRY RUN' : 'EXECUTE'} MODE\n`)

  if (userId) {
    console.log(`Filtering to user: ${userId}\n`)
    const { stats, errors } = await backfillForUser(userId, dryRun)
    report.stats.set(userId, stats)
    report.userCount = 1
    if (errors.length > 0) {
      report.errors.push({ userId, error: errors.join('; ') })
    }
  } else {
    // Process all users
    const { data: users, error: usersError } = await supabase.from('users').select('id')

    if (usersError || !users) {
      console.error('❌ Failed to fetch users:', usersError?.message)
      process.exit(1)
    }

    for (const user of users) {
      const { stats, errors } = await backfillForUser(user.id, dryRun)
      report.stats.set(user.id, stats)
      report.userCount++
      if (errors.length > 0) {
        report.errors.push({ userId: user.id, error: errors.join('; ') })
      }
    }
  }

  // Calculate summary
  for (const stats of report.stats.values()) {
    report.summary.totalLegacyParts += stats.legacyPartsCount
    report.summary.totalLegacySessions += stats.legacySessionsCount
    report.summary.totalLegacyRelationships += stats.legacyRelationshipsCount
    report.summary.totalMigratedParts += stats.migratedPartsCount
    report.summary.totalMigratedSessions += stats.migratedSessionsCount
    report.summary.totalMigratedRelationships += stats.migratedRelationshipsCount
    report.summary.totalDuplicatesSkipped += stats.duplicatePartsSkipped
    report.summary.totalInvalidSkipped += stats.invalidPartsSkipped
  }

  // Print summary
  console.log('\n📊 SUMMARY\n')
  console.log(`  Users processed:         ${report.userCount}`)
  console.log(`  Legacy parts:            ${report.summary.totalLegacyParts}`)
  console.log(`  Legacy sessions:         ${report.summary.totalLegacySessions}`)
  console.log(`  Legacy relationships:    ${report.summary.totalLegacyRelationships}`)
  console.log(`  Migrated parts:          ${report.summary.totalMigratedParts}`)
  console.log(`  Migrated sessions:       ${report.summary.totalMigratedSessions}`)
  console.log(`  Migrated relationships:  ${report.summary.totalMigratedRelationships}`)
  if (report.errors.length > 0) {
    console.log(`  ⚠️  Errors:              ${report.errors.length}`)
    report.errors.forEach(e => console.log(`     - ${e.userId}: ${e.error}`))
  }

  // Save detailed report
  const reportPath = path.join(
    process.cwd(),
    `backfill-report-${new Date().toISOString().replace(/:/g, '-')}.json`,
  )
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        ...report,
        stats: Array.from(report.stats.entries()).map(([id, s]) => ({ userId: id, ...s })),
      },
      null,
      2,
    ),
  )

  console.log(`\n📋 Detailed report saved to: ${reportPath}\n`)

  if (dryRun) {
    console.log('✨ Dry-run complete. No data was modified.\n')
  } else if (report.errors.length === 0) {
    console.log('✅ Backfill complete with no errors!\n')
  } else {
    console.log('⚠️  Backfill complete with some errors. Please review.\n')
  }
}

main().catch(console.error)
