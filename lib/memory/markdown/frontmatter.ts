import { z } from 'zod'
import matter from 'gray-matter'
import { partCategoryEnum, partStatusEnum } from '@/lib/data/parts.schema'

/**
 * YAML frontmatter schema for part profile markdown files
 * This provides structured metadata at the top of the file,
 * complementing the section-based content below.
 */
export const partFrontmatterSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    emoji: z.string().min(1).max(8).optional().nullable(),
    category: partCategoryEnum.default('unknown'),
    status: partStatusEnum.default('emerging'),
    tags: z.array(z.string()).default([]),
    related_parts: z.array(z.string().uuid()).default([]),
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
    last_active: z.string().datetime().optional(),
    // Activity metrics and other metadata reserved for future metadata agent
    activity_metrics: z.unknown().optional(),
  })
  .strict()

export type PartFrontmatter = z.infer<typeof partFrontmatterSchema>

/**
 * Partial frontmatter for creation (optional fields can be omitted)
 */
export type PartFrontmatterInput = Omit<PartFrontmatter, 'id' | 'created_at' | 'updated_at' | 'last_active'> &
  Partial<Pick<PartFrontmatter, 'id' | 'created_at' | 'updated_at' | 'last_active'>>

/**
 * Parse markdown text with optional YAML frontmatter
 * Returns null frontmatter if no frontmatter is present (backward compatible)
 */
export function parsePartMarkdown(text: string): {
  frontmatter: PartFrontmatter | null
  content: string
} {
  try {
    const { data, content } = matter(text)

    // If no frontmatter or empty object, return null
    if (!data || Object.keys(data).length === 0) {
      return { frontmatter: null, content: text }
    }

    const parsed = partFrontmatterSchema.safeParse(data)
    if (!parsed.success) {
      console.warn('Invalid part frontmatter, ignoring:', parsed.error.issues)
      return { frontmatter: null, content }
    }

    return { frontmatter: parsed.data, content }
  } catch (error) {
    // If gray-matter fails to parse, treat entire text as content
    console.warn('Failed to parse frontmatter:', error)
    return { frontmatter: null, content: text }
  }
}

/**
 * Serialize frontmatter to YAML format
 */
export function stringifyPartFrontmatter(fm: PartFrontmatter | PartFrontmatterInput): string {
  const lines: string[] = []
  const entries = Object.entries(fm)

  for (const [key, value] of entries) {
    if (value === undefined) continue

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`)
      } else {
        lines.push(`${key}:`)
        for (const v of value) {
          lines.push(`  - ${String(v)}`)
        }
      }
    } else if (value !== null && typeof value === 'object') {
      // Store nested objects as JSON for simplicity
      lines.push(`${key}: ${JSON.stringify(value)}`)
    } else {
      lines.push(`${key}: ${value === null ? 'null' : String(value)}`)
    }
  }

  return lines.join('\n')
}

/**
 * Build complete markdown document with frontmatter and content
 */
export function buildPartMarkdownWithFrontmatter(
  frontmatter: PartFrontmatter | PartFrontmatterInput,
  content: string
): string {
  const fm = stringifyPartFrontmatter(frontmatter)
  return `---\n${fm}\n---\n\n${content.trim()}\n`
}

/**
 * Update frontmatter in existing markdown, preserving content
 */
export function updatePartFrontmatter(
  text: string,
  updates: Partial<PartFrontmatter>
): string {
  const parsed = parsePartMarkdown(text)

  // If no existing frontmatter, cannot update (would need full frontmatter)
  if (!parsed.frontmatter) {
    throw new Error('Cannot update frontmatter: no existing frontmatter found')
  }

  const updated = { ...parsed.frontmatter, ...updates }
  return buildPartMarkdownWithFrontmatter(updated, parsed.content)
}
