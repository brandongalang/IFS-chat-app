import { z } from 'zod'
import { partCategoryEnum, partStatusEnum } from '@/lib/data/parts.schema'

export const frontmatterSchema = z
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
    // Activity metrics and other metadata reserved for future metadata agent.
    activity_metrics: z.unknown().optional(),
  })
  .strict()

export type Frontmatter = z.infer<typeof frontmatterSchema>

export interface ParsedDocument {
  frontmatter: Frontmatter
  sections: Record<string, string>
}

function isFence(line: string): boolean {
  return line.trim() === '---'
}

function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
}

export function parseText(text: string): ParsedDocument {
  const lines = text.split(/\r?\n/)
  let idx = 0
  let fm: any = {}

  if (lines[0] && isFence(lines[0])) {
    idx = 1
    const fmLines: string[] = []
    while (idx < lines.length && !isFence(lines[idx])) {
      fmLines.push(lines[idx])
      idx++
    }
    // Skip closing fence
    if (idx < lines.length && isFence(lines[idx])) idx++

    // Minimal YAML subset parser: key: value, arrays with "- value".
    const obj: Record<string, any> = {}
    let currentArrayKey: string | null = null
    for (const raw of fmLines) {
      const line = raw.trimEnd()
      if (!line) continue
      if (line.startsWith('- ') && currentArrayKey) {
        const val = line.slice(2).trim()
        ;(obj[currentArrayKey] = obj[currentArrayKey] || []).push(coerceScalar(val))
        continue
      }
      const m = line.match(/^(\w[\w_]*):\s*(.*)$/)
      if (m) {
        const [, key, rest] = m
        if (rest === '' || rest === null) {
          // Possibly start of a list in following lines
          currentArrayKey = key
          obj[key] = obj[key] || []
        } else if (rest === '|' || rest === '>') {
          // Multiline scalars not supported fully; treat as empty for now
          obj[key] = ''
          currentArrayKey = null
        } else {
          obj[key] = coerceScalar(rest)
          currentArrayKey = null
        }
      } else {
        currentArrayKey = null
      }
    }
    fm = obj
  }

  // Remaining is markdown body
  const body = lines.slice(idx).join('\n')
  const sections = splitSections(body)

  const parsed = frontmatterSchema.safeParse(fm)
  if (!parsed.success) {
    // Throw with concise message to surface validation issues early
    throw new Error('Invalid parts frontmatter: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '))
  }

  return { frontmatter: parsed.data, sections }
}

export function serializeDocument(doc: ParsedDocument): string {
  const fm = stringifyFrontmatter(doc.frontmatter)
  const body = joinSections(doc.sections)
  return `---\n${fm}\n---\n\n${body}`.trim() + '\n'
}

export function splitSections(markdown: string): Record<string, string> {
  const lines = markdown.split(/\r?\n/)
  const map: Record<string, string> = {}
  let currentTitle: string | null = null
  let buf: string[] = []

  function commit() {
    if (currentTitle !== null) {
      map[slugify(currentTitle)] = buf.join('\n').replace(/^\n+|\n+$/g, '')
    }
  }

  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) {
      // New section
      commit()
      currentTitle = m[1]
      buf = []
    } else {
      buf.push(line)
    }
  }
  commit()

  // If no sections detected, treat entire body as a single section named 'body'
  if (Object.keys(map).length === 0 && markdown.trim().length > 0) {
    map['body'] = markdown.trim()
  }

  return map
}

export function joinSections(sections: Record<string, string>): string {
  const entries = Object.entries(sections)
  if (entries.length === 0) return ''
  return entries
    .map(([key, content]) => {
      const title = deslugify(key)
      return `## ${title}\n\n${(content || '').trim()}\n`
    })
    .join('\n')
    .trim() + '\n'
}

function deslugify(slug: string): string {
  const s = slug.replace(/-/g, ' ')
  return s.length ? s[0].toUpperCase() + s.slice(1) : 'Section'
}

function coerceScalar(v: string): any {
  const raw = v.trim()
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw === 'null' || raw === 'undefined' || raw === '~') return null
  if (/^\d+$/.test(raw)) return parseInt(raw, 10)
  if (/^\d+\.\d+$/.test(raw)) return parseFloat(raw)
  if (/^\[.*\]$/.test(raw)) {
    try { return JSON.parse(raw) } catch {}
  }
  // JSON-encoded objects
  if (/^\{.*\}$/.test(raw)) {
    try { return JSON.parse(raw) } catch {}
  }
  // Strip wrapping quotes if present
  const q = raw.match(/^['"](.*)['"]$/)
  return q ? q[1] : raw
}

function stringifyFrontmatter(fm: Frontmatter): string {
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
    } else if (value && typeof value === 'object') {
      // Store nested objects as JSON for simplicity
      lines.push(`${key}: ${JSON.stringify(value)}`)
    } else {
      lines.push(`${key}: ${value === null ? 'null' : String(value)}`)
    }
  }
  return lines.join('\n')
}