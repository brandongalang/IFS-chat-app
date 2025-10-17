const TOOL_COPY_RULES: Array<{
  match: RegExp
  title: string
  note?: string
  statusCopy?: string
}> = [
  {
    match: /(search|lookup|retrieve|query|parts|insight|observation|memory)/i,
    title: "Looking through notes…",
  },
  {
    match: /(write|save|record|log|note|capture|store)/i,
    title: "Writing notes…",
  },
  {
    match: /(summarize|summary|digest|condense)/i,
    title: "Summarizing…",
  },
  {
    match: /(gather|collect|context|prepare|load|fetch)/i,
    title: "Gathering context…",
  },
  {
    match: /(plan|brainstorm|analyze|assess|review)/i,
    title: "Thinking it through…",
  },
]

function cleanToolName(candidate?: string | null): string {
  if (!candidate) return ""
  return candidate
    .replace(/^tool[-:]/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function titleCase(value: string): string {
  if (!value) return value
  return value
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

export type ToolDisplayCopy = {
  title: string
  note?: string
  statusCopy?: string
}

export function getToolDisplayCopy(rawName?: string | null, toolType?: string | null): ToolDisplayCopy {
  const name = cleanToolName(rawName) || cleanToolName(toolType)

  for (const rule of TOOL_COPY_RULES) {
    if (name && rule.match.test(name)) {
      return {
        title: rule.title,
        note: rule.note,
        statusCopy: rule.statusCopy,
      }
    }
  }

  const fallbackTitle = titleCase(name)
  if (fallbackTitle) {
    return { title: fallbackTitle }
  }

  return { title: "Working on it…" }
}

export function friendlyLabelFromType(toolType?: string | null): string {
  const cleaned = cleanToolName(toolType)
  if (!cleaned) return "Tool"
  const titled = titleCase(cleaned)
  return titled || "Tool"
}
