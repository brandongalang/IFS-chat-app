/**
 * Sync markdown part profiles to the database
 * This ensures parts created via chat appear in the Garden and check-ins
 */

import { getStorageAdapter } from './snapshots/fs-helpers';
import { readPartProfileSections } from './read';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PartCategory, PartStatus } from '@/lib/types/database';

interface MarkdownPartData {
  partId: string;
  name: string;
  status: PartStatus;
  category: PartCategory;
  role?: string;
  evidence?: string[];
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

/**
 * Discover all part profiles for a user from markdown storage
 */
export async function discoverUserParts(userId: string): Promise<string[]> {
  const storage = await getStorageAdapter();
  const basePath = `users/${userId}/parts`;

  try {
    // List all directories under parts/
    const entries = await storage.list(basePath);

    // Extract part IDs from paths like "users/{userId}/parts/{partId}/profile.md"
    const partIds: string[] = [];
    for (const entry of entries) {
      // Check if it's a part profile
      if (entry.endsWith('/profile.md')) {
        const match = entry.match(/parts\/([^\/]+)\/profile\.md$/);
        if (match) {
          partIds.push(match[1]);
        }
      }
    }

    return partIds;
  } catch (error) {
    console.error(`Failed to discover parts for user ${userId}:`, error);
    return [];
  }
}

/**
 * Sync a single markdown part profile to the database
 */
export async function syncPartToDatabase(userId: string, partId: string): Promise<boolean> {
  try {
    // Read the markdown profile
    const sections = await readPartProfileSections(userId, partId);
    if (!sections) {
      console.warn(`No markdown profile found for part ${partId}`);
      return false;
    }

    // Parse the markdown data
    const partData = parsePartFromMarkdown(sections, partId);
    if (!partData) {
      console.warn(`Failed to parse markdown for part ${partId}`);
      return false;
    }

    // Connect to database
    const supabase = createAdminClient();

    // Check if part already exists
    const { data: existing } = await supabase
      .from('parts')
      .select('id, name, status, category, visualization')
      .eq('id', partId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Update existing part if data has changed
      const needsUpdate =
        existing.name !== partData.name ||
        existing.status !== partData.status ||
        existing.category !== partData.category;

      if (needsUpdate) {
        const { error } = await supabase
          .from('parts')
          .update({
            name: partData.name,
            status: partData.status,
            category: partData.category,
            role: partData.role,
            // Preserve existing visualization or set default
            visualization: existing.visualization || { emoji: '🧩', color: '#6B7280' },
            last_active: new Date().toISOString(),
          })
          .eq('id', partId)
          .eq('user_id', userId);

        if (error) {
          console.error(`Failed to update part ${partId}:`, error);
          return false;
        }

        console.log(`Updated part ${partId} (${partData.name}) in database`);
      }
    } else {
      // Insert new part
      const { error } = await supabase.from('parts').insert({
        id: partId,
        user_id: userId,
        name: partData.name,
        status: partData.status,
        category: partData.category,
        role: partData.role,
        visualization: { emoji: '🧩', color: '#6B7280' },
        triggers: [],
        emotions: [],
        beliefs: [],
        last_active: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error(`Failed to insert part ${partId}:`, error);
        return false;
      }

      console.log(`Created part ${partId} (${partData.name}) in database`);
    }

    return true;
  } catch (error) {
    console.error(`Failed to sync part ${partId}:`, error);
    return false;
  }
}

/**
 * Sync all markdown part profiles for a user to the database
 */
export async function syncAllUserParts(
  userId: string
): Promise<{ synced: number; failed: number }> {
  console.log(`Starting parts sync for user ${userId}`);

  // Discover all part profiles
  const partIds = await discoverUserParts(userId);
  console.log(`Found ${partIds.length} part profiles to sync`);

  if (partIds.length === 0) {
    return { synced: 0, failed: 0 };
  }

  // Sync each part
  let synced = 0;
  let failed = 0;

  for (const partId of partIds) {
    const success = await syncPartToDatabase(userId, partId);
    if (success) {
      synced++;
    } else {
      failed++;
    }
  }

  console.log(`Parts sync complete: ${synced} synced, ${failed} failed`);
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
