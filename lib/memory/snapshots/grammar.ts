import { canonicalizeText } from '../canonicalize'
import { buildPartMarkdownWithFrontmatter, type PartFrontmatterInput } from '../markdown/frontmatter'

export type SnapshotType = 'user_overview' | 'part_profile'

export function buildUserOverviewMarkdown(userId: string): string {
  const content = `# User Overview\n\n## Identity\n[//]: # (anchor: identity v1)\n\n- User ID: ${userId}\n\n## Current Focus\n[//]: # (anchor: current_focus v1)\n\n- TBD\n\n## Confirmed Parts\n[//]: # (anchor: confirmed_parts v1)\n\n- TBD\n\n## Change Log\n[//]: # (anchor: change_log v1)\n\n- ${new Date().toISOString()}: initialized overview\n`
return canonicalizeText(content)
}

export function buildRelationshipProfileMarkdown(params: { userId: string; relId: string; type: string }): string {
  const content = `# Relationship\n\n## Participants\n[//]: # (anchor: participants v1)\n\n- TBD\n\n## Type\n[//]: # (anchor: type v1)\n\n- ${params.type}\n\n## Dynamics\n[//]: # (anchor: dynamics v1)\n\n- TBD\n\n## Change Log\n[//]: # (anchor: change_log v1)\n\n- ${new Date().toISOString()}: initialized relationship profile\n`
  return canonicalizeText(content)
}

export function buildPartProfileMarkdown(part: { userId: string; partId: string; name: string; status: string; category: string; emoji?: string }): string {
  const now = new Date().toISOString()
  
  // Build YAML frontmatter
  const frontmatter: PartFrontmatterInput = {
    id: part.partId,
    name: part.name,
    emoji: part.emoji || null,
    category: part.category as 'manager' | 'firefighter' | 'exile' | 'unknown',
    status: part.status as 'emerging' | 'acknowledged' | 'active' | 'integrated',
    tags: [],
    related_parts: [],
    created_at: now,
    updated_at: now,
    last_active: now,
  }
  
  // Build section-based content (keep existing anchor format)
  const content = `# Part: ${part.name}

## Identity
[//]: # (anchor: identity v1)

- Part ID: ${part.partId}
- User ID: ${part.userId}
- Status: ${part.status}
- Category: ${part.category}

## Role
[//]: # (anchor: role v1)

- TBD

## Evidence (curated)
[//]: # (anchor: evidence v1)

- (add up to 7 items)

## Change Log
[//]: # (anchor: change_log v1)

- ${now}: initialized profile
`
  
  // Combine frontmatter + content, then canonicalize
  const markdown = buildPartMarkdownWithFrontmatter(frontmatter, content)
  return canonicalizeText(markdown)
}

