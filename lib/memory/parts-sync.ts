/**
 * Sync markdown part profiles to the database
 * This ensures parts created via chat appear in the Garden and check-ins
 */

import { getStorageAdapter } from './snapshots/fs-helpers';
import { readPartProfile } from './read';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPart, upsertPart } from '@/lib/data/schema/server';
import type { UpsertPartInput } from '@/lib/data/schema/parts';
import type { PartCategory, PartStatus } from '@/lib/types/database';

interface MarkdownPartData {
  partId: string;
  name: string;
  status: PartStatus;
  category: PartCategory;
  role?: string;
  evidence?: string[];
  emoji?: string | null;
}

/**
 * Parse part data from markdown profile sections
 */
function parsePartFromMarkdown(
  sections: Record<string, { heading: string; text: string }>,
  partId: string
): MarkdownPartData | null {
  const identitySection = sections['identity v1'];
  if (!identitySection) return null;

  // Parse identity section for core data
  const lines = identitySection.text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let name = 'Unknown Part';
  let status: PartStatus = 'emerging';
  let category: PartCategory = 'unknown';

  for (const line of lines) {
    // Parse "- Key: Value" format
    const match = line.match(/^-\s*(.+?):\s*(.+)$/);
    if (!match) continue;

    const [, key, value] = match;
    const normalizedKey = key.toLowerCase().trim();

    if (normalizedKey === 'part id') {
      // Verify part ID matches
      if (value !== partId) {
        console.warn(`Part ID mismatch: expected ${partId}, found ${value}`);
      }
    } else if (normalizedKey === 'status') {
      const statusValue = value.toLowerCase();
      if (['emerging', 'acknowledged', 'active', 'integrated'].includes(statusValue)) {
        status = statusValue as PartStatus;
      }
    } else if (normalizedKey === 'category') {
      const categoryValue = value.toLowerCase();
      if (['manager', 'firefighter', 'exile', 'unknown'].includes(categoryValue)) {
        category = categoryValue as PartCategory;
      }
    }
  }

  // Extract name from the title (# Part: Name)
  const titleMatch = sections['identity v1']?.text.match(/Part:\s*(.+)/);
  if (titleMatch) {
    name = titleMatch[1].trim();
  }

  // Get role from role section
  const roleSection = sections['role v1'];
  const role = roleSection?.text.replace(/^-\s*/, '').trim();

  // Get evidence items
  const evidenceSection = sections['evidence v1'];
  const evidence: string[] = [];
  if (evidenceSection) {
    const evidenceLines = evidenceSection.text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('-'))
      .map((l) => l.substring(1).trim())
      // Filter out placeholder/template text from evidence
      .filter((l) => l && !l.includes('add up to'));
    evidence.push(...evidenceLines);
  }

  return {
    partId,
    name,
    status,
    category,
    role,
    evidence,
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry ?? '')))
    .filter((entry) => entry.length > 0);
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

/**
 * Discover all part profiles for a user from markdown storage
 */
export async function discoverUserParts(userId: string): Promise<string[]> {
  console.log(`[discoverUserParts] Starting discovery for user ${userId}`);
  const storage = await getStorageAdapter();
  const basePath = `users/${userId}/parts`;
  console.log(`[discoverUserParts] Looking in path: ${basePath}`);

  try {
    // List all directories under parts/
    const entries = await storage.list(basePath);
    console.log(`[discoverUserParts] Found ${entries.length} entries in storage:`, entries);

    // Extract part IDs from paths like "{userId}/parts/{partId}/profile.md"
    const partIds: string[] = [];
    for (const entry of entries) {
      console.log(`[discoverUserParts] Checking entry: ${entry}`);
      // Check if it's a part profile
      if (entry.endsWith('/profile.md')) {
        const match = entry.match(/parts\/([^\/]+)\/profile\.md$/);
        if (match) {
          console.log(`[discoverUserParts] Found part ID: ${match[1]}`);
          partIds.push(match[1]);
        } else {
          console.log(`[discoverUserParts] Entry didn't match pattern: ${entry}`);
        }
      }
    }

    console.log(`[discoverUserParts] Discovered ${partIds.length} part IDs:`, partIds);
    return partIds;
  } catch (error) {
    console.error(`[discoverUserParts] Failed to discover parts for user ${userId}:`, error);
    return [];
  }
}

/**
 * Sync a single markdown part profile to the database
 */
export async function syncPartToDatabase(userId: string, partId: string): Promise<boolean> {
  console.log(`[syncPartToDatabase] Starting sync for part ${partId}`);
  try {
    // Read the markdown profile (with frontmatter if available)
    console.log(`[syncPartToDatabase] Reading profile for part ${partId}`);
    const profile = await readPartProfile(userId, partId);
    console.log(`[syncPartToDatabase] Profile read result:`, profile ? 'found' : 'not found');
    if (!profile) {
      console.warn(`[syncPartToDatabase] No markdown profile found for part ${partId}`);
      return false;
    }
    console.log(`[syncPartToDatabase] Profile sections:`, Object.keys(profile.sections));
    console.log(`[syncPartToDatabase] Profile frontmatter:`, profile.frontmatter);

    // Prefer frontmatter data if available, otherwise parse from sections
    let partData: MarkdownPartData;
    
    if (profile.frontmatter) {
      // Modern format: use frontmatter
      const roleSection = profile.sections['role v1'];
      const role = roleSection?.text.replace(/^-\s*/, '').trim();
      
      const evidenceSection = profile.sections['evidence v1'];
      const evidence: string[] = [];
      if (evidenceSection) {
        const evidenceLines = evidenceSection.text
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.startsWith('-'))
          .map((l) => l.substring(1).trim())
          .filter((l) => l && !l.includes('add up to'));
        evidence.push(...evidenceLines);
      }
      
      partData = {
        partId: profile.frontmatter.id,
        name: profile.frontmatter.name,
        status: profile.frontmatter.status,
        category: profile.frontmatter.category,
        role,
        evidence,
        emoji: profile.frontmatter.emoji,
      };
    } else {
      // Legacy format: parse from sections
      const parsed = parsePartFromMarkdown(profile.sections, partId);
      if (!parsed) {
        console.warn(`Failed to parse markdown for part ${partId}`);
        return false;
      }
      partData = parsed;
    }

    // Connect to database via service role
    console.log(`[syncPartToDatabase] Connecting to database (PRD helpers)`);
    const supabase = createAdminClient();
    const deps = { client: supabase, userId };

    console.log(`[syncPartToDatabase] Checking PRD record for part ${partId}`);
    const existing = await getPart(partId, deps);
    console.log(`[syncPartToDatabase] Existing PRD record:`, existing ? 'yes' : 'no');

    const now = new Date().toISOString();
    const existingData = toRecord(existing?.data);

    const existingRole =
      typeof existingData.role === 'string' && existingData.role.trim().length > 0
        ? existingData.role
        : null;

    const existingEvidence = toStringArray(existingData.recent_evidence);
    const finalEvidence = Array.isArray(partData.evidence) && partData.evidence.length > 0
      ? partData.evidence
      : existingEvidence;

    const existingVisualization = toRecord(existingData.visualization);
    const visualization = {
      emoji: partData.emoji ?? (typeof existingVisualization.emoji === 'string' ? existingVisualization.emoji : '🧩'),
      color: typeof existingVisualization.color === 'string' ? existingVisualization.color : '#6B7280',
      energyLevel:
        typeof existingVisualization.energyLevel === 'number' ? existingVisualization.energyLevel : 0.5,
    };

    const updatedData: Record<string, unknown> = {
      ...existingData,
      role: partData.role ?? existingRole ?? null,
      recent_evidence: finalEvidence,
      visualization,
      markdown_sync: {
        last_synced_at: now,
        source: 'markdown_profile',
      },
    };

    const payload: UpsertPartInput = {
      id: partId,
      name: partData.name,
      status: partData.status,
      category: partData.category,
      charge: existing?.charge ?? 'neutral',
      data: updatedData,
      evidence_count: finalEvidence.length,
      confidence: existing?.confidence ?? 0.5,
      needs_attention: existing?.needs_attention ?? false,
      last_active: now,
    };

    if (!existing?.first_noticed) {
      payload.first_noticed = now;
    }

    const hasMeaningfulChanges =
      !existing ||
      existing.name !== payload.name ||
      existing.status !== payload.status ||
      existing.category !== payload.category ||
      (partData.role !== undefined && (existingRole ?? null) !== (partData.role ?? null)) ||
      (partData.emoji !== undefined &&
        (typeof existingVisualization.emoji === 'string' ? existingVisualization.emoji : '🧩') !== visualization.emoji) ||
      !arraysEqual(finalEvidence, existingEvidence);

    if (!hasMeaningfulChanges && existing) {
      console.log(`[syncPartToDatabase] Part ${partId} unchanged (updating sync metadata only)`);
    }

    // TODO(ifs-chat-app-5): Replace generic upsert with dedicated PRD markdown sync helper when available.
    await upsertPart(payload, deps);

    console.log(
      `[syncPartToDatabase] ✅ ${existing ? 'Updated' : 'Created'} part ${partId} (${partData.name}) via PRD helpers`
    );

    return true;
  } catch (error) {
    console.error(`[syncPartToDatabase] ❌ Failed to sync part ${partId}:`, error);
    return false;
  }
}

/**
 * Sync all markdown part profiles for a user to the database
 */
export async function syncAllUserParts(
  userId: string
): Promise<{ synced: number; failed: number }> {
  console.log(`[syncAllUserParts] ========================================`);
  console.log(`[syncAllUserParts] Starting parts sync for user ${userId}`);
  console.log(`[syncAllUserParts] ========================================`);

  // Discover all part profiles
  const partIds = await discoverUserParts(userId);
  console.log(`[syncAllUserParts] Found ${partIds.length} part profiles to sync`);

  if (partIds.length === 0) {
    console.log(`[syncAllUserParts] No parts found in markdown storage`);
    return { synced: 0, failed: 0 };
  }

  // Sync each part
  let synced = 0;
  let failed = 0;

  for (const partId of partIds) {
    console.log(`[syncAllUserParts] Syncing part ${synced + failed + 1}/${partIds.length}: ${partId}`);
    const success = await syncPartToDatabase(userId, partId);
    if (success) {
      synced++;
      console.log(`[syncAllUserParts] ✅ Part ${partId} synced successfully`);
    } else {
      failed++;
      console.log(`[syncAllUserParts] ❌ Part ${partId} sync failed`);
    }
  }

  console.log(`[syncAllUserParts] ========================================`);
  console.log(`[syncAllUserParts] Parts sync complete: ${synced} synced, ${failed} failed`);
  console.log(`[syncAllUserParts] ========================================`);
  return { synced, failed };
}

/**
 * Hook to be called when a part is created or updated via chat
 * This ensures the part appears immediately in the UI
 */
export async function onPartProfileChanged(userId: string, partId: string) {
  console.log(`Part profile changed: ${partId}, syncing to database...`);
  const success = await syncPartToDatabase(userId, partId);
  if (success) {
    console.log(`Successfully synced part ${partId} to database`);
  } else {
    console.error(`Failed to sync part ${partId} to database`);
  }
}
