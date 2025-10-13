/**
 * Repository API for Part profiles in the memory system
 * 
 * Provides clean, high-level functions for querying and updating parts,
 * wrapping the lower-level storage adapter and markdown parsing utilities.
 * 
 * This layer combines:
 * - YAML frontmatter (structured metadata)
 * - Section anchors (precise content editing)
 * - StorageAdapter (Supabase Storage or local filesystem)
 * - User-scoping (memory/users/{userId}/parts/{partId}/profile.md)
 */

import { getStorageAdapter, partProfilePath } from '@/lib/memory/snapshots/fs-helpers'
import { readPartProfile, type PartProfileData } from '@/lib/memory/read'
import { parsePartMarkdown, updatePartFrontmatter as updateFrontmatterText, type PartFrontmatter } from '@/lib/memory/markdown/frontmatter'
import { editMarkdownSection } from '@/lib/memory/markdown/editor'
import { onPartProfileChanged } from '@/lib/memory/parts-sync'
import type { PartCategory, PartStatus } from '@/lib/types/database'

/**
 * Filters for querying parts
 */
export interface ListPartsFilters {
  query?: string // Search by name
  category?: PartCategory
  status?: PartStatus
  tag?: string
  limit?: number
}

/**
 * Summary information about a part (for list views)
 */
export interface PartSummary {
  id: string
  name: string
  emoji?: string | null
  category: PartCategory
  status: PartStatus
  tags: string[]
  last_active?: string
}

/**
 * Complete part data (frontmatter + sections)
 */
export interface Part extends PartSummary {
  frontmatter: PartFrontmatter | null
  sections: Record<string, { heading: string; text: string }>
  related_parts: string[]
  created_at?: string
  updated_at?: string
}

/**
 * List all parts for a user with optional filters
 */
export async function listParts(userId: string, filters: ListPartsFilters = {}): Promise<PartSummary[]> {
  const storage = await getStorageAdapter()
  const basePath = `users/${userId}/parts`

  try {
    // List all part profile files
    const entries = await storage.list(basePath)
    const partIds: string[] = []

    // Extract part IDs from paths like "users/{userId}/parts/{partId}/profile.md"
    for (const entry of entries) {
      const match = entry.match(/parts\/([^\/]+)\/profile\.md$/)
      if (match) {
        partIds.push(match[1])
      }
    }

    // Read each part's frontmatter
    const parts: PartSummary[] = []
    for (const partId of partIds) {
      const profile = await readPartProfile(userId, partId)
      if (!profile) continue

      // If no frontmatter, try to extract from sections (backward compatibility)
      let summary: PartSummary
      if (profile.frontmatter) {
        summary = {
          id: profile.frontmatter.id,
          name: profile.frontmatter.name,
          emoji: profile.frontmatter.emoji,
          category: profile.frontmatter.category,
          status: profile.frontmatter.status,
          tags: profile.frontmatter.tags || [],
          last_active: profile.frontmatter.last_active,
        }
      } else {
        // Fallback: parse from identity section
        const identitySection = profile.sections['identity v1']
        if (!identitySection) continue

        const lines = identitySection.text.split('\n')
        let name = 'Unknown Part'
        let status: PartStatus = 'emerging'
        let category: PartCategory = 'unknown'

        for (const line of lines) {
          const match = line.match(/^-\s*(.+?):\s*(.+)$/)
          if (!match) continue
          const [, key, value] = match
          const normalizedKey = key.toLowerCase().trim()

          if (normalizedKey === 'status') {
            status = value.toLowerCase() as PartStatus
          } else if (normalizedKey === 'category') {
            category = value.toLowerCase() as PartCategory
          }
        }

        // Extract name from heading
        const titleMatch = identitySection.text.match(/Part:\s*(.+)/)
        if (titleMatch) {
          name = titleMatch[1].trim()
        }

        summary = {
          id: partId,
          name,
          category,
          status,
          tags: [],
        }
      }

      // Apply filters
      if (filters.category && summary.category !== filters.category) continue
      if (filters.status && summary.status !== filters.status) continue
      if (filters.tag && !summary.tags.includes(filters.tag)) continue
      if (filters.query) {
        const q = filters.query.toLowerCase()
        if (!summary.name.toLowerCase().includes(q)) continue
      }

      parts.push(summary)

      // Apply limit
      if (filters.limit && parts.length >= filters.limit) break
    }

    return parts
  } catch (error) {
    console.error(`Failed to list parts for user ${userId}:`, error)
    return []
  }
}

/**
 * Read a complete part profile by ID
 */
export async function readPart(userId: string, partId: string): Promise<Part | null> {
  const profile = await readPartProfile(userId, partId)
  if (!profile) return null

  const { frontmatter, sections } = profile

  // Build Part object
  if (frontmatter) {
    return {
      id: frontmatter.id,
      name: frontmatter.name,
      emoji: frontmatter.emoji,
      category: frontmatter.category,
      status: frontmatter.status,
      tags: frontmatter.tags || [],
      related_parts: frontmatter.related_parts || [],
      created_at: frontmatter.created_at,
      updated_at: frontmatter.updated_at,
      last_active: frontmatter.last_active,
      frontmatter,
      sections,
    }
  }

  // Fallback for parts without frontmatter (backward compatibility)
  const identitySection = sections['identity v1']
  if (!identitySection) return null

  let name = 'Unknown Part'
  let status: PartStatus = 'emerging'
  let category: PartCategory = 'unknown'

  const lines = identitySection.text.split('\n')
  for (const line of lines) {
    const match = line.match(/^-\s*(.+?):\s*(.+)$/)
    if (!match) continue
    const [, key, value] = match
    const normalizedKey = key.toLowerCase().trim()

    if (normalizedKey === 'status') {
      status = value.toLowerCase() as PartStatus
    } else if (normalizedKey === 'category') {
      category = value.toLowerCase() as PartCategory
    }
  }

  const titleMatch = identitySection.text.match(/Part:\s*(.+)/)
  if (titleMatch) {
    name = titleMatch[1].trim()
  }

  return {
    id: partId,
    name,
    category,
    status,
    tags: [],
    related_parts: [],
    frontmatter: null,
    sections,
  }
}

/**
 * Update part frontmatter (metadata only, not content)
 */
export async function updatePartFrontmatter(
  userId: string,
  partId: string,
  updates: Partial<PartFrontmatter>
): Promise<void> {
  const storage = await getStorageAdapter()
  const path = partProfilePath(userId, partId)

  const text = await storage.getText(path)
  if (!text) {
    throw new Error(`Part profile not found: ${partId}`)
  }

  // Update frontmatter, preserving content
  const updated = updateFrontmatterText(text, {
    ...updates,
    updated_at: new Date().toISOString(),
  })

  await storage.putText(path, updated, { contentType: 'text/markdown; charset=utf-8' })

  // Trigger sync to database
  await onPartProfileChanged(userId, partId)
}

/**
 * Update a specific section in the part profile
 */
export async function updatePartSection(
  userId: string,
  partId: string,
  anchor: string,
  change: { replace?: string; append?: string }
): Promise<void> {
  const path = partProfilePath(userId, partId)

  // Use existing editMarkdownSection which handles frontmatter correctly
  await editMarkdownSection(path, anchor, change)

  // Trigger sync to database
  await onPartProfileChanged(userId, partId)
}

/**
 * Check if a part exists
 */
export async function partExists(userId: string, partId: string): Promise<boolean> {
  const storage = await getStorageAdapter()
  const path = partProfilePath(userId, partId)
  return await storage.exists(path)
}
