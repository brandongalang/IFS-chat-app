import { createObservationResearchTools } from './inbox-observation-tools'

export type MarkdownTools = Pick<
  ReturnType<typeof createObservationResearchTools>,
  'listMarkdown' | 'searchMarkdown' | 'readMarkdown'
>

export function createMarkdownTools(baseUserId: string | null | undefined): MarkdownTools {
  const resolvedBaseUserId =
    typeof baseUserId === 'string' && baseUserId.trim().length > 0 ? baseUserId.trim() : null
  const observationTools = createObservationResearchTools(resolvedBaseUserId)

  return {
    listMarkdown: observationTools.listMarkdown,
    searchMarkdown: observationTools.searchMarkdown,
    readMarkdown: observationTools.readMarkdown,
  }
}
