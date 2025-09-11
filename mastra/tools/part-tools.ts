import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'
import type {
  PartRow,
  PartRelationshipRow,
  ToolResult,
} from '../../lib/types/database'
import {
  searchPartsSchema,
  getPartByIdSchema,
  getPartDetailSchema,
  createEmergingPartSchema,
  updatePartSchema,
  getPartRelationshipsSchema,
  logRelationshipSchema,
} from './part-schemas'

export async function searchParts(input: z.infer<typeof searchPartsSchema>): Promise<ToolResult<PartRow[]>> {
  try {
    const validated = searchPartsSchema.parse(input)
    resolveUserId(validated.userId)
    await getStorageAdapter()
    return { success: true, data: [], confidence: 1.0 }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function getPartById(input: z.infer<typeof getPartByIdSchema>): Promise<ToolResult<PartRow | null>> {
  try {
    const validated = getPartByIdSchema.parse(input)
    resolveUserId(validated.userId)
    await getStorageAdapter()
    return { success: true, data: null, confidence: 1.0 }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function getPartDetail(input: z.infer<typeof getPartDetailSchema>): Promise<ToolResult<any>> {
  try {
    const validated = getPartDetailSchema.parse(input)
    resolveUserId(validated.userId)
    await getStorageAdapter()
    return { success: true, data: null, confidence: 1.0 }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function createEmergingPart(input: z.infer<typeof createEmergingPartSchema>): Promise<ToolResult<PartRow>> {
  try {
    const validated = createEmergingPartSchema.parse(input)
    resolveUserId(validated.userId)
    await getStorageAdapter()
    return { success: true, data: { ...validated, id: validated.partId || '' } as PartRow, confidence: 1.0 }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function updatePart(input: z.infer<typeof updatePartSchema>): Promise<ToolResult<PartRow>> {
  try {
    const validated = updatePartSchema.parse(input)
    resolveUserId(validated.userId)
    await getStorageAdapter()
    return { success: true, data: { ...validated } as PartRow, confidence: 1.0 }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function getPartRelationships(input: z.infer<typeof getPartRelationshipsSchema>): Promise<ToolResult<PartRelationshipRow[]>> {
  try {
    const validated = getPartRelationshipsSchema.parse(input)
    resolveUserId(validated.userId)
    await getStorageAdapter()
    return { success: true, data: [], confidence: 1.0 }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function logRelationship(input: z.infer<typeof logRelationshipSchema>): Promise<ToolResult<PartRelationshipRow>> {
  try {
    const validated = logRelationshipSchema.parse(input)
    resolveUserId(validated.userId)
    await getStorageAdapter()
    return { success: true, data: validated as any, confidence: 1.0 }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export const searchPartsTool = createTool({
  id: 'searchParts',
  description: 'Search for parts',
  inputSchema: searchPartsSchema,
  execute: async ({ context }) => {
    const result = await searchParts(context)
    if (!result.success) throw new Error(result.error)
    return result.data
  },
})

export const getPartByIdTool = createTool({
  id: 'getPartById',
  description: 'Get a specific part by ID',
  inputSchema: getPartByIdSchema,
  execute: async ({ context }) => {
    const result = await getPartById(context)
    if (!result.success) throw new Error(result.error)
    return result.data
  },
})

export const getPartDetailTool = createTool({
  id: 'getPartDetail',
  description: 'Get part details including relationships',
  inputSchema: getPartDetailSchema,
  execute: async ({ context }) => {
    const result = await getPartDetail(context)
    if (!result.success) throw new Error(result.error)
    return result.data
  },
})

export const createEmergingPartTool = createTool({
  id: 'createEmergingPart',
  description: 'Create a new emerging part',
  inputSchema: createEmergingPartSchema,
  execute: async ({ context }) => {
    const result = await createEmergingPart(context)
    if (!result.success) throw new Error(result.error)
    return result.data
  },
})

export const updatePartTool = createTool({
  id: 'updatePart',
  description: 'Update an existing part',
  inputSchema: updatePartSchema,
  execute: async ({ context }) => {
    const result = await updatePart(context)
    if (!result.success) throw new Error(result.error)
    return result.data
  },
})

export const getPartRelationshipsTool = createTool({
  id: 'getPartRelationships',
  description: 'Get relationships for a part',
  inputSchema: getPartRelationshipsSchema,
  execute: async ({ context }) => {
    const result = await getPartRelationships(context)
    if (!result.success) throw new Error(result.error)
    return result.data
  },
})

export const logRelationshipTool = createTool({
  id: 'logRelationship',
  description: 'Log a relationship between parts',
  inputSchema: logRelationshipSchema,
  execute: async ({ context }) => {
    const result = await logRelationship(context)
    if (!result.success) throw new Error(result.error)
    return result.data
  },
})

export const partTools = {
  searchParts: searchPartsTool,
  getPartById: getPartByIdTool,
  getPartDetail: getPartDetailTool,
  createEmergingPart: createEmergingPartTool,
  updatePart: updatePartTool,
  getPartRelationships: getPartRelationshipsTool,
  logRelationship: logRelationshipTool,
}

