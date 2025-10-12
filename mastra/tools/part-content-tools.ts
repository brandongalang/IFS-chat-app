import { createTool } from '@mastra/core'
import { z } from 'zod'
import { listParts, readPartById, createPart, updatePartContent, type ListPartsFilters } from '@/lib/parts/repository'
import { frontmatterSchema } from '@/lib/parts/spec'
import { partCategoryEnum, partStatusEnum } from '@/lib/data/parts.schema'

// Input schemas for stronger typing
const listPartsInputSchema = z
  .object({
    query: z.string().optional(),
    category: partCategoryEnum.optional(),
    status: partStatusEnum.optional(),
    tag: z.string().optional(),
  })
  .strict()

const readPartInputSchema = z.object({ id: z.string().uuid() }).strict()

const createPartInputSchema = z
  .object({
    frontmatter: frontmatterSchema.partial({ id: true, created_at: true, updated_at: true, last_active: true }),
    sections: z.record(z.string()).optional(),
    fileName: z.string().optional(),
  })
  .strict()

const updatePartContentInputSchema = z
  .object({
    id: z.string().uuid(),
    updates: z
      .array(
        z.object({
          section: z.string().min(1),
          mode: z.enum(['replace', 'append', 'prepend']),
          text: z.string(),
        }),
      )
      .min(1),
  })
  .strict()

// 1) get_parts_metadata_summary
export const getPartsMetadataSummary = createTool({
  id: 'get_parts_metadata_summary',
  description: 'Summarize parts metadata (counts by category/status, tag set)',
  inputSchema: z.object({}).strict(),
  execute: async () => {
    const all = await listParts()
    const byCategory = all.reduce<Record<string, number>>((acc, p) => {
      acc[p.category] = (acc[p.category] ?? 0) + 1
      return acc
    }, {})
    const byStatus = all.reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1
      return acc
    }, {})
    const tags = new Set<string>()
    all.forEach(p => (p.tags || []).forEach(t => tags.add(t)))
    return { total: all.length, byCategory, byStatus, tags: Array.from(tags).sort() }
  },
})

// 2) list_parts
export const listPartsTool = createTool({
  id: 'list_parts',
  description: 'List parts by YAML metadata filters',
  inputSchema: listPartsInputSchema,
  execute: async ({ context }: { context: z.infer<typeof listPartsInputSchema> }) => {
    const filters: ListPartsFilters = {
      query: context.query,
      category: context.category,
      status: context.status,
      tag: context.tag,
    }
    const items = await listParts(filters)
    return items
  },
})

// 3) read_part
export const readPartTool = createTool({
  id: 'read_part',
  description: 'Read a part by ID, returning frontmatter and markdown sections',
  inputSchema: readPartInputSchema,
  execute: async ({ context }: { context: z.infer<typeof readPartInputSchema> }) => {
    const doc = await readPartById(context.id)
    if (!doc) return null
    return doc
  },
})

// 4) create_part
export const createPartTool = createTool({
  id: 'create_part',
  description: 'Create a new part file with frontmatter and optional sections',
  inputSchema: createPartInputSchema,
  execute: async ({ context }: { context: z.infer<typeof createPartInputSchema> }) => {
    const { filePath, doc } = await createPart({
      frontmatter: context.frontmatter,
      sections: context.sections,
      fileName: context.fileName,
    })
    return { filePath, doc }
  },
})

// 5) update_part_content
export const updatePartContentTool = createTool({
  id: 'update_part_content',
  description: 'Modify markdown sections for a part (replace/append/prepend)',
  inputSchema: updatePartContentInputSchema,
  execute: async ({ context }: { context: z.infer<typeof updatePartContentInputSchema> }) => {
    const updated = await updatePartContent({ id: context.id, updates: context.updates })
    return updated
  },
})

export const partContentTools = {
  get_parts_metadata_summary: getPartsMetadataSummary,
  list_parts: listPartsTool,
  read_part: readPartTool,
  create_part: createPartTool,
  update_part_content: updatePartContentTool,
}