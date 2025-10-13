import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'
import { listSections } from '@/lib/memory/markdown/md'
import { userOverviewPath, partProfilePath, relationshipProfilePath } from '@/lib/memory/snapshots/fs-helpers'
import { parsePartMarkdown, type PartFrontmatter } from '@/lib/memory/markdown/frontmatter'

export interface SectionMap { [anchor: string]: { heading: string; text: string } }

export interface PartProfileData {
  frontmatter: PartFrontmatter | null
  sections: SectionMap
}

async function readFileText(path: string): Promise<string | null> {
  const storage = await getStorageAdapter()
  return await storage.getText(path)
}

function buildSectionMap(text: string): SectionMap {
  const sections = listSections(text)
  const lines = text.split(/\r?\n/)
  const map: SectionMap = {}
  for (const s of sections) {
    // drop first two lines (heading + anchor marker)
    const body = lines.slice(s.start + 2, s.end).join('\n').trim()
    map[s.anchor] = { heading: s.heading, text: body }
  }
  return map
}

export async function readOverviewSections(userId: string): Promise<SectionMap | null> {
  const path = userOverviewPath(userId)
  const text = await readFileText(path)
  if (!text) return null
  return buildSectionMap(text)
}

/**
 * Read part profile sections (legacy - returns only sections)
 * @deprecated Use readPartProfile() to get both frontmatter and sections
 */
export async function readPartProfileSections(userId: string, partId: string): Promise<SectionMap | null> {
  const path = partProfilePath(userId, partId)
  const text = await readFileText(path)
  if (!text) return null
  return buildSectionMap(text)
}

/**
 * Read complete part profile with frontmatter and sections
 */
export async function readPartProfile(userId: string, partId: string): Promise<PartProfileData | null> {
  const path = partProfilePath(userId, partId)
  const text = await readFileText(path)
  if (!text) return null
  
  // Parse frontmatter (if present)
  const { frontmatter, content } = parsePartMarkdown(text)
  
  // Build section map from content
  const sections = buildSectionMap(content)
  
  return { frontmatter, sections }
}

export async function readRelationshipProfileSections(userId: string, relId: string): Promise<SectionMap | null> {
  const path = relationshipProfilePath(userId, relId)
  const text = await readFileText(path)
  if (!text) return null
  return buildSectionMap(text)
}

