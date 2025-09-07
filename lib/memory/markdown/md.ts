import { canonicalizeText, sha256Hex } from '@/lib/memory/canonicalize'

export interface SectionInfo {
  anchor: string
  heading: string
  start: number // inclusive line index
  end: number   // exclusive line index (one past the section)
}

const ANCHOR_PATTERNS = [
  /^<!--\s*@anchor:\s*(.+?)\s*-->\s*$/,
  /^\[\/\/\]:\s*#\s*\(anchor:\s*(.+?)\s*\)\s*$/,
]

export function listSections(text: string): SectionInfo[] {
  const lines = text.split(/\r?\n/)
  const sections: SectionInfo[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('## ')) {
      const heading = line.slice(3).trim()
      // next non-empty line should contain anchor marker
      let j = i + 1
      let anchor: string | null = null
      while (j < lines.length && lines[j].trim().length === 0) j++
      if (j < lines.length) {
        const m = ANCHOR_PATTERNS.map(rx => rx.exec(lines[j])).find(Boolean) as RegExpExecArray | undefined
        if (m) anchor = m[1].trim()
      }
      // find end: next '## ' or EOF
      let k = i + 1
      while (k < lines.length && !lines[k].startsWith('## ')) k++
      if (anchor) sections.push({ anchor, heading, start: i, end: k })
    }
  }
  return sections
}

export function patchSectionByAnchor(input: string, anchor: string, change: { replace?: string; append?: string }) {
  const lines = input.split(/\r?\n/)
  const sections = listSections(input)
  const target = sections.find(s => s.anchor === anchor)
  if (!target) {
    throw new Error(`Section with anchor '${anchor}' not found`)
  }
  const before = canonicalizeText(input)
  let bodyLines = lines.slice(target.start, target.end)

  if (typeof change.replace === 'string') {
    // Replace entire section body except the first two lines (heading + anchor marker)
    const head = bodyLines.slice(0, 2)
    bodyLines = head.concat(canonicalizeText(change.replace).split('\n'))
  } else if (typeof change.append === 'string') {
    bodyLines = bodyLines.concat(canonicalizeText(change.append).split('\n'))
  }

  const newLines = lines.slice(0, target.start).concat(bodyLines).concat(lines.slice(target.end))
  const out = canonicalizeText(newLines.join('\n'))
  return {
    text: out,
    beforeHash: 'sha256:' + sha256Hex(before),
    afterHash: 'sha256:' + sha256Hex(out),
  }
}

export function lintMarkdown(text: string): { warnings: string[]; blocked: boolean; blockedReasons?: string[] } {
  const warnings: string[] = []
  const sections = listSections(text)
  // Basic checks: all H2 sections should have an anchor; canonical names are free-form here (we don't enforce exact set yet)
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      const next = lines[i + 1] || ''
      if (!ANCHOR_PATTERNS.some(rx => rx.test(next))) {
        warnings.push(`Missing anchor marker after H2 at line ${i + 1}`)
      }
    }
  }
  // Soft cap example: warn if Evidence list appears to exceed ~7 bullets
  const evidence = sections.find(s => s.anchor.toLowerCase().includes('evidence'))
  if (evidence) {
    const body = text.split(/\r?\n/).slice(evidence.start, evidence.end).join('\n')
    const bulletCount = (body.match(/^\s*[-*]\s+/gm) || []).length
    if (bulletCount > 7) warnings.push(`Evidence items exceed soft cap (found ${bulletCount} > 7)`)  
  }
  return { warnings, blocked: false }
}

