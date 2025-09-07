import { canonicalizeText } from '../canonicalize'

export type SnapshotType = 'user_overview' | 'part_profile'

export function buildUserOverviewMarkdown(userId: string): string {
  const content = `# User Overview\n\n## Identity\n[//]: # (anchor: identity v1)\n\n- User ID: ${userId}\n\n## Current Focus\n[//]: # (anchor: current_focus v1)\n\n- TBD\n\n## Confirmed Parts\n[//]: # (anchor: confirmed_parts v1)\n\n- TBD\n\n## Change Log\n[//]: # (anchor: change_log v1)\n\n- ${new Date().toISOString()}: initialized overview\n`
return canonicalizeText(content)
}

export function buildRelationshipProfileMarkdown(params: { userId: string; relId: string; type: string }): string {
  const content = `# Relationship\n\n## Participants\n[//]: # (anchor: participants v1)\n\n- TBD\n\n## Type\n[//]: # (anchor: type v1)\n\n- ${params.type}\n\n## Dynamics\n[//]: # (anchor: dynamics v1)\n\n- TBD\n\n## Change Log\n[//]: # (anchor: change_log v1)\n\n- ${new Date().toISOString()}: initialized relationship profile\n`
  return canonicalizeText(content)
}

export function buildPartProfileMarkdown(part: { userId: string; partId: string; name: string; status: string; category: string }): string {
  const content = `# Part: ${part.name}\n\n## Identity\n[//]: # (anchor: identity v1)\n\n- Part ID: ${part.partId}\n- User ID: ${part.userId}\n- Status: ${part.status}\n- Category: ${part.category}\n\n## Role\n[//]: # (anchor: role v1)\n\n- TBD\n\n## Evidence (curated)\n[//]: # (anchor: evidence v1)\n\n- (add up to 7 items)\n\n## Change Log\n[//]: # (anchor: change_log v1)\n\n- ${new Date().toISOString()}: initialized profile\n`
  return canonicalizeText(content)
}

