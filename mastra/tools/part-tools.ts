import { randomUUID } from 'crypto'
import { createTool } from '@mastra/core'
import { z } from 'zod'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'
import type {
  PartRow,
  PartRelationshipRow,
  ToolResult,
} from '@/lib/types/database'
import {
  searchPartsSchema,
  getPartByIdSchema,
  getPartDetailSchema,
  createEmergingPartSchema,
  updatePartSchema,
  getPartRelationshipsSchema,
  logRelationshipSchema,
} from './part-schemas'

const STUB_USER_ID = "00000000-0000-0000-0000-000000000000"

function makeStubPart(userId: string, overrides: Partial<PartRow> = {}): PartRow {
  const now = new Date().toISOString()
  return {
    id: overrides.id ?? randomUUID(),
    user_id: overrides.user_id ?? userId,
    name: overrides.name ?? 'Emerging Part',
    status: overrides.status ?? 'emerging',
    category: overrides.category ?? 'unknown',
    age: overrides.age ?? null,
    role: overrides.role ?? null,
    triggers: overrides.triggers ?? [],
    emotions: overrides.emotions ?? [],
    beliefs: overrides.beliefs ?? [],
    somatic_markers: overrides.somatic_markers ?? [],
    confidence: overrides.confidence ?? 0,
    evidence_count: overrides.evidence_count ?? 0,
    recent_evidence: overrides.recent_evidence ?? [],
    story: overrides.story ?? { origin: null, currentState: null, purpose: null, evolution: [] },
    relationships: overrides.relationships ?? {},
    visualization:
      overrides.visualization ?? ({ emoji: '❔', color: '#7f7f7f', energyLevel: 0.1 } as PartRow['visualization']),
    first_noticed: overrides.first_noticed ?? now,
    acknowledged_at: overrides.acknowledged_at ?? null,
    last_active: overrides.last_active ?? now,
    last_interaction_at: overrides.last_interaction_at ?? now,
    last_charged_at: overrides.last_charged_at ?? null,
    last_charge_intensity: overrides.last_charge_intensity ?? null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  }
}

function makeStubRelationship(userId: string, partIds: string[]): PartRelationshipRow {
  const now = new Date().toISOString()
  const ids = partIds.length > 0 ? partIds : [randomUUID(), randomUUID()]
  return {
    id: randomUUID(),
    user_id: userId,
    parts: ids,
    type: 'allied',
    description: null,
    issue: null,
    common_ground: null,
    dynamics: [],
    status: 'active',
    polarization_level: 0,
    last_addressed: null,
    created_at: now,
    updated_at: now,
  }
}

export async function searchParts(input: z.infer<typeof searchPartsSchema>): Promise<ToolResult<PartRow[]>> {
  try {
    const validated = searchPartsSchema.parse(input)
    await getStorageAdapter()
    return { success: true, data: [], confidence: 1.0 }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function getPartById(input: z.infer<typeof getPartByIdSchema>): Promise<ToolResult<PartRow | null>> {
  try {
    const validated = getPartByIdSchema.parse(input)
    await getStorageAdapter()
    return { success: true, data: null, confidence: 1.0 }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function getPartDetail(input: z.infer<typeof getPartDetailSchema>): Promise<ToolResult<any>> {
  try {
    const validated = getPartDetailSchema.parse(input)
    await getStorageAdapter()
    return { success: true, data: null, confidence: 1.0 }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function createEmergingPart(input: z.infer<typeof createEmergingPartSchema>): Promise<ToolResult<PartRow>> {
  try {
    const validated = createEmergingPartSchema.parse(input)
    const userId = STUB_USER_ID
    await getStorageAdapter()
    const part = makeStubPart(userId, {
      name: validated.name,
      category: validated.category,
      age: validated.age ?? null,
      role: validated.role ?? null,
      triggers: validated.triggers ?? [],
      emotions: validated.emotions ?? [],
      beliefs: validated.beliefs ?? [],
      somatic_markers: validated.somaticMarkers ?? [],
      recent_evidence: validated.evidence,
      evidence_count: validated.evidence.length,
      confidence: 0.1,
    })
    return { success: true, data: part, confidence: 0.1 }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function updatePart(input: z.infer<typeof updatePartSchema>): Promise<ToolResult<PartRow>> {
  try {
    const validated = updatePartSchema.parse(input)
    const userId = STUB_USER_ID
    await getStorageAdapter()
    const base = makeStubPart(userId, { id: validated.partId })
    const updates = validated.updates
    const now = new Date().toISOString()

    const updatedVisualization = updates.visualization
      ? { ...base.visualization, ...updates.visualization }
      : base.visualization

    const updatedPart = makeStubPart(userId, {
      ...base,
      name: updates.name ?? base.name,
      status: updates.status ?? base.status,
      category: updates.category ?? base.category,
      age: updates.age ?? base.age,
      role: updates.role ?? base.role,
      triggers: updates.triggers ?? base.triggers,
      emotions: updates.emotions ?? base.emotions,
      beliefs: updates.beliefs ?? base.beliefs,
      somatic_markers: updates.somaticMarkers ?? base.somatic_markers,
      visualization: updatedVisualization,
      last_charged_at: updates.last_charged_at ?? base.last_charged_at,
      last_charge_intensity: updates.last_charge_intensity ?? base.last_charge_intensity,
      updated_at: now,
    })

    if (typeof updates.confidenceBoost === 'number') {
      updatedPart.confidence = Math.max(0, Math.min(1, base.confidence + updates.confidenceBoost))
    }

    if (validated.evidence) {
      updatedPart.recent_evidence = [validated.evidence]
      updatedPart.evidence_count = 1
    }

    return { success: true, data: updatedPart, confidence: 0.9 }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function getPartRelationships(input: z.infer<typeof getPartRelationshipsSchema>): Promise<ToolResult<PartRelationshipRow[]>> {
  try {
    const validated = getPartRelationshipsSchema.parse(input)
    await getStorageAdapter()
    return { success: true, data: [], confidence: 1.0 }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function logRelationship(input: z.infer<typeof logRelationshipSchema>): Promise<ToolResult<PartRelationshipRow>> {
  try {
    const validated = logRelationshipSchema.parse(input)
    const userId = STUB_USER_ID
    await getStorageAdapter()
    const relationship = makeStubRelationship(userId, validated.partIds)
    return { success: true, data: relationship, confidence: 0.5 }
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
