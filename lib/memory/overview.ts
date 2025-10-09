import { ensureOverviewExists } from '@/lib/memory/snapshots/scaffold'
import { readOverviewSections, type SectionMap } from '@/lib/memory/read'

const TARGET_ANCHORS = ['identity v1', 'current_focus v1', 'change_log v1'] as const

export type OverviewAnchor = (typeof TARGET_ANCHORS)[number]

export interface OverviewFragment {
  anchor: OverviewAnchor
  heading: string
  text: string
}

export interface OverviewSnapshot {
  created: boolean
  fragments: OverviewFragment[]
}

export async function loadOverviewSnapshot(userId: string | null | undefined): Promise<OverviewSnapshot | null> {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : ''
  if (!normalizedUserId) {
    return null
  }

  try {
    let sections = await readOverviewSections(normalizedUserId)
    let created = false

    if (!sections) {
      const ensureResult = await ensureOverviewExists(normalizedUserId)
      created = ensureResult.created
      sections = await readOverviewSections(normalizedUserId)
    }

    return {
      created,
      fragments: extractFragments(sections ?? null),
    }
  } catch (error) {
    console.error('[Overview] Failed to load overview snapshot', {
      userId: normalizedUserId,
      error,
    })
    return null
  }
}

export function formatOverviewFragments(fragments: OverviewFragment[]): string {
  if (fragments.length === 0) {
    return ''
  }

  return fragments
    .map(({ heading, anchor, text }) => {
      const trimmed = text.trim()
      const body = trimmed.length > 0 ? trimmed : 'Unavailable'
      return `### ${heading}\n[//]: # (anchor: ${anchor})\n\n${body}`
    })
    .join('\n\n')
}

function extractFragments(sections: SectionMap | null): OverviewFragment[] {
  if (!sections) {
    return []
  }

  const fragments: OverviewFragment[] = []

  for (const anchor of TARGET_ANCHORS) {
    const section = sections[anchor]
    if (!section) continue
    fragments.push({
      anchor,
      heading: section.heading,
      text: section.text,
    })
  }

  return fragments
}
