import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { frontmatterSchema, parseText, serializeDocument, type Frontmatter, type ParsedDocument } from '@/lib/parts/spec'
import { z } from 'zod'

const DEFAULT_BASE_DIR = path.resolve(process.cwd(), 'content', 'parts')

export type PartsRepositoryOptions = {
  baseDir?: string
}

/**
 * Normalize section key to match the slugification logic used in splitSections
 * Strips heading markers (##), removes non-alphanumerics, collapses whitespace
 */
function normalizeSectionKey(section: string): string {
  return section
    .trim()
    .replace(/^#+\s*/, '') // Remove heading markers like ##
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumerics except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
}

async function ensureDir(dir: string) {
  await fsp.mkdir(dir, { recursive: true })
}

async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fsp.readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

function resolveBaseDir(opts?: PartsRepositoryOptions): string {
  return opts?.baseDir ? path.resolve(opts.baseDir) : DEFAULT_BASE_DIR
}

function isMarkdownFile(file: string): boolean {
  return file.endsWith('.md') || file.endsWith('.mdx')
}

async function listMarkdownFiles(baseDir: string): Promise<string[]> {
  try {
    const entries = await fsp.readdir(baseDir, { withFileTypes: true })
    const files: string[] = []
    for (const e of entries) {
      const p = path.join(baseDir, e.name)
      if (e.isFile() && isMarkdownFile(e.name)) files.push(p)
      if (e.isDirectory()) {
        const idx = path.join(p, 'index.md')
        if (fs.existsSync(idx)) files.push(idx)
      }
    }
    return files
  } catch {
    return []
  }
}

export type ListPartsFilters = {
  query?: string
  category?: Frontmatter['category']
  status?: Frontmatter['status']
  tag?: string
}

export type PartSummary = Pick<Frontmatter, 'id' | 'name' | 'emoji' | 'category' | 'status' | 'tags' | 'last_active'> & {
  filePath: string
}

export async function listParts(filters: ListPartsFilters = {}, opts?: PartsRepositoryOptions): Promise<PartSummary[]> {
  const baseDir = resolveBaseDir(opts)
  const files = await listMarkdownFiles(baseDir)
  const results: PartSummary[] = []
  for (const file of files) {
    const raw = await readFileSafe(file)
    if (!raw) continue
    try {
      const parsed = parseText(raw)
      if (filters.category && parsed.frontmatter.category !== filters.category) continue
      if (filters.status && parsed.frontmatter.status !== filters.status) continue
      if (filters.tag && !parsed.frontmatter.tags?.includes(filters.tag)) continue
      if (filters.query) {
        const q = filters.query.toLowerCase()
        if (!parsed.frontmatter.name.toLowerCase().includes(q)) continue
      }
      const { id, name, emoji, category, status, tags, last_active } = parsed.frontmatter
      results.push({ id, name, emoji: emoji ?? undefined, category, status, tags, last_active, filePath: file })
    } catch {
      // Skip invalid files
      continue
    }
  }
  return results
}

export async function readPartById(id: string, opts?: PartsRepositoryOptions): Promise<ParsedDocument | null> {
  z.string().uuid().parse(id)
  const baseDir = resolveBaseDir(opts)
  const files = await listMarkdownFiles(baseDir)
  for (const file of files) {
    const raw = await readFileSafe(file)
    if (!raw) continue
    try {
      const parsed = parseText(raw)
      if (parsed.frontmatter.id === id) return parsed
    } catch {}
  }
  return null
}

export type CreatePartInput = {
  frontmatter: Omit<Frontmatter, 'id' | 'created_at' | 'updated_at' | 'last_active'> & Partial<Pick<Frontmatter, 'id'>>
  sections?: Record<string, string>
  fileName?: string // optional override (e.g., slug)
}

export async function createPart(input: CreatePartInput, opts?: PartsRepositoryOptions): Promise<{ filePath: string; doc: ParsedDocument }> {
  const baseDir = resolveBaseDir(opts)
  await ensureDir(baseDir)

  const now = new Date().toISOString()
  const id = input.frontmatter.id ?? randomUUID()
  const fmCandidate = {
    ...input.frontmatter,
    id,
    created_at: now,
    updated_at: now,
    last_active: now,
  }
  const fm = frontmatterSchema.parse(fmCandidate)

  const sections = input.sections ?? { 'role-purpose': '' }
  const doc: ParsedDocument = { frontmatter: fm, sections }
  const text = serializeDocument(doc)

  // Sanitize filename, falling back to UUID if slug is empty (e.g., name with only symbols)
  const slug = (input.fileName ?? fm.name)
    .toLowerCase()
    .replace(/[^a-z0-9\-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
  
  // Fall back to UUID if slug is empty to prevent .md files and collisions
  const fileName = slug || id
  const filePath = path.join(baseDir, `${fileName}.md`)

  await fsp.writeFile(filePath, text, 'utf8')
  return { filePath, doc }
}

export type UpdatePartContentInput = {
  id: string
  updates: Array<{
    section: string // slug or title; we will treat as slug
    mode: 'replace' | 'append' | 'prepend'
    text: string
  }>
}

export async function updatePartContent(input: UpdatePartContentInput, opts?: PartsRepositoryOptions): Promise<ParsedDocument> {
  const { id, updates } = input
  z.string().uuid().parse(id)
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error('No updates provided')
  }

  const baseDir = resolveBaseDir(opts)
  const files = await listMarkdownFiles(baseDir)
  for (const file of files) {
    const raw = await readFileSafe(file)
    if (!raw) continue
    try {
      const parsed = parseText(raw)
      if (parsed.frontmatter.id !== id) continue

      // apply updates to sections only; do not modify frontmatter except timestamps
      const sections = { ...parsed.sections }
      for (const u of updates) {
        // Use the same normalization logic as splitSections to match existing keys
        const key = normalizeSectionKey(u.section)
        const existing = sections[key] ?? ''
        if (u.mode === 'replace') sections[key] = u.text
        else if (u.mode === 'append') sections[key] = [existing, u.text].filter(Boolean).join('\n\n')
        else if (u.mode === 'prepend') sections[key] = [u.text, existing].filter(Boolean).join('\n\n')
      }

      const updated: ParsedDocument = {
        frontmatter: {
          ...parsed.frontmatter,
          updated_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        },
        sections,
      }

      const text = serializeDocument(updated)
      await fsp.writeFile(file, text, 'utf8')
      return updated
    } catch {}
  }
  throw new Error(`Part with id ${id} not found in ${baseDir}`)
}