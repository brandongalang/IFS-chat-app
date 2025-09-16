import 'server-only'

import { z } from 'zod'

import { resolveUserId, requiresUserConfirmation, devLog } from '@/config/dev'
import type { PartRow, PartInsert } from '../types/database'
import { getSupabaseClient } from './parts.common'

const createEmergingPartSchema = z.object({
  name: z.string().min(1).max(100).describe('Name of the emerging part'),
  evidence: z
    .array(
      z.object({
        type: z.enum(['direct_mention', 'pattern', 'behavior', 'emotion']),
        content: z.string(),
        confidence: z.number().min(0).max(1),
        sessionId: z.string().uuid(),
        timestamp: z.string().datetime(),
      })
    )
    .min(3)
    .describe('Evidence supporting the part (minimum 3 required)'),
  category: z.enum(['manager', 'firefighter', 'exile', 'unknown']).optional().default('unknown'),
  age: z.number().min(0).max(100).optional().describe('Perceived age of the part'),
  role: z.string().optional().describe('Role or function of the part'),
  triggers: z.array(z.string()).optional().default([]).describe('Known triggers for this part'),
  emotions: z.array(z.string()).optional().default([]).describe('Emotions associated with this part'),
  beliefs: z.array(z.string()).optional().default([]).describe('Beliefs held by this part'),
  somaticMarkers: z.array(z.string()).optional().default([]).describe('Physical sensations associated with this part'),
  userId: z.string().uuid().optional().describe('User ID who owns the part (optional in development mode)'),
  userConfirmed: z
    .boolean()
    .describe('Whether the user has confirmed this part exists through chat interaction'),
})

const updatePartSchema = z.object({
  partId: z.string().uuid().describe('The UUID of the part to update'),
  userId: z.string().uuid().optional().describe('User ID who owns the part (optional in development mode)'),
  updates: z
    .object({
      name: z.string().min(1).max(100).optional(),
      status: z.enum(['emerging', 'acknowledged', 'active', 'integrated']).optional(),
      category: z.enum(['manager', 'firefighter', 'exile', 'unknown']).optional(),
      age: z.number().min(0).max(100).optional(),
      role: z.string().optional(),
      triggers: z.array(z.string()).optional(),
      emotions: z.array(z.string()).optional(),
      beliefs: z.array(z.string()).optional(),
      somaticMarkers: z.array(z.string()).optional(),
      visualization: z
        .object({
          emoji: z.string(),
          color: z.string(),
        })
        .optional(),
      confidenceBoost: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('Amount to adjust identification confidence by (explicit only)'),
      last_charged_at: z
        .string()
        .datetime()
        .optional()
        .describe("Timestamp for when the part's charge was last updated"),
      last_charge_intensity: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Intensity of the part's last charge (0 to 1)"),
    })
    .describe('Fields to update'),
  evidence: z
    .object({
      type: z.enum(['direct_mention', 'pattern', 'behavior', 'emotion']),
      content: z.string(),
      confidence: z.number().min(0).max(1),
      sessionId: z.string().uuid(),
      timestamp: z.string().datetime(),
    })
    .optional()
    .describe('New evidence to add for this update'),
  auditNote: z.string().optional().describe('Note about why this update was made'),
})

/**
 * Create an emerging part with 3+ evidence rule enforcement
 */
export async function createEmergingPart(input: z.infer<typeof createEmergingPartSchema>): Promise<PartRow> {
  try {
    const validated = createEmergingPartSchema.parse(input)
    const userId = resolveUserId(validated.userId)

    // Enforce 3+ evidence rule
    if (validated.evidence.length < 3) {
      throw new Error('Cannot create emerging part: At least 3 pieces of evidence are required')
    }

    // Check user confirmation (always required - should happen through chat)
    if (requiresUserConfirmation(validated.userConfirmed)) {
      throw new Error('Cannot create emerging part: User confirmation is required through chat interaction')
    }

    const supabase = getSupabaseClient()

    devLog('createEmergingPart called', {
      userId,
      partName: validated.name,
      evidenceCount: validated.evidence.length,
    })

    // Check if part with same name already exists for this user
    const { data: existingPart } = await supabase
      .from('parts')
      .select('id, name')
      .eq('user_id', userId)
      .eq('name', validated.name)
      .single()

    if (existingPart) {
      throw new Error(`A part named "${validated.name}" already exists for this user`)
    }

    // Calculate initial confidence based on evidence quality
    const avgEvidenceConfidence =
      validated.evidence.reduce((sum, ev) => sum + ev.confidence, 0) / validated.evidence.length
    const initialConfidence = Math.min(0.95, avgEvidenceConfidence * 0.8) // Cap at 95% for emerging parts

    // Create the part
    const partInsert: PartInsert = {
      user_id: userId,
      name: validated.name,
      status: 'emerging',
      category: validated.category,
      age: validated.age,
      role: validated.role,
      triggers: validated.triggers,
      emotions: validated.emotions,
      beliefs: validated.beliefs,
      somatic_markers: validated.somaticMarkers,
      confidence: initialConfidence,
      evidence_count: validated.evidence.length,
      recent_evidence: validated.evidence,
      story: {
        origin: null,
        currentState: `Newly discovered part with ${validated.evidence.length} pieces of evidence`,
        purpose: validated.role || null,
        evolution: [
          {
            timestamp: new Date().toISOString(),
            change: 'Part created',
            trigger: 'Evidence threshold reached',
          },
        ],
      },
      visualization: {
        emoji: '🤗',
        color: '#6B7280',
        energyLevel: 0.5,
      },
    }

    // Use action logger for INSERT with rollback capability
    const { actionLogger } = await import('../database/action-logger')
    const data = await actionLogger.loggedInsert<PartRow>(
      'parts',
      partInsert as any,
      userId,
      'create_emerging_part',
      {
        partName: validated.name,
        changeDescription: `Created emerging part with ${validated.evidence.length} pieces of evidence`,
        sessionId: validated.evidence[0]?.sessionId,
        evidenceCount: validated.evidence.length,
        category: validated.category,
        confidence: initialConfidence,
      }
    )

    return data
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

/**
 * Update a part with confidence increment and audit trail
 */
export async function updatePart(input: z.infer<typeof updatePartSchema>): Promise<PartRow> {
  try {
    const validated = updatePartSchema.parse(input)
    const userId = resolveUserId(validated.userId)
    const supabase = getSupabaseClient()

    devLog('updatePart called', { userId, partId: validated.partId })

    // First, get the current part
    const { data: currentPart, error: fetchError } = await supabase
      .from('parts')
      .select('*')
      .eq('id', validated.partId)
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch part: ${fetchError.message}`)
    }

    if (!currentPart) {
      throw new Error('Part not found or access denied')
    }

    // Prepare update object
    const updates: any = {
      ...validated.updates,
      last_active: new Date().toISOString(),
    }

    // If updating visualization, merge with existing
    if (validated.updates.visualization) {
      const currentVis = (currentPart.visualization as any) || {}
      const nextVis = { ...currentVis, ...validated.updates.visualization }
      if (typeof (nextVis as any).energyLevel !== 'number') {
        ;(nextVis as any).energyLevel = currentVis.energyLevel ?? 0.5
      }
      updates.visualization = nextVis as any
    }

    // Only update identification confidence if explicitly requested
    if (typeof validated.updates.confidenceBoost === 'number') {
      updates.confidence = Math.min(
        1.0,
        Math.max(0, currentPart.confidence + validated.updates.confidenceBoost)
      )
    }

    // Add evidence if provided
    if (validated.evidence) {
      const currentEvidence = currentPart.recent_evidence || []
      const newEvidence = [...currentEvidence, validated.evidence].slice(-10) // Keep only last 10
      updates.recent_evidence = newEvidence
      updates.evidence_count = currentPart.evidence_count + 1
    }

    // Update story evolution with audit trail
    const currentStory = currentPart.story || { origin: null, currentState: null, purpose: null, evolution: [] }
    const evolutionEntry = {
      timestamp: new Date().toISOString(),
      change: validated.auditNote || 'Part updated',
      trigger: 'Agent tool update',
    }

    updates.story = {
      ...currentStory,
      evolution: [...(currentStory.evolution || []), evolutionEntry],
    }

    // Handle somatic_markers correctly (database expects snake_case)
    if (validated.updates.somaticMarkers) {
      const somaticMarkersValue = validated.updates.somaticMarkers
      delete (updates as any).somaticMarkers
      updates.somatic_markers = somaticMarkersValue
    }

    // Determine action type and generate change description
    let actionType:
      | 'update_part_confidence'
      | 'update_part_category'
      | 'update_part_attributes'
      | 'add_part_evidence'
      | 'update_part_charge' = 'update_part_attributes'
    let changeDescription = 'Updated part attributes'

    if (validated.updates.name && validated.updates.name !== currentPart.name) {
      changeDescription = `renamed part from "${currentPart.name}" to "${validated.updates.name}"`
    } else if (validated.updates.visualization) {
      changeDescription = 'updated part visualization'
    } else if (typeof validated.updates.last_charge_intensity === 'number') {
      actionType = 'update_part_charge'
      changeDescription = `updated part charge to ${validated.updates.last_charge_intensity.toFixed(2)}`
    } else if (typeof validated.updates.confidenceBoost === 'number') {
      actionType = 'update_part_confidence'
      const toVal = updates.confidence ?? currentPart.confidence
      const direction = validated.updates.confidenceBoost >= 0 ? 'increased' : 'decreased'
      changeDescription = `${direction} confidence from ${currentPart.confidence} to ${toVal}`
    } else if (validated.updates.category && validated.updates.category !== currentPart.category) {
      actionType = 'update_part_category'
      changeDescription = `changed category from ${currentPart.category} to ${validated.updates.category}`
    } else if (validated.evidence) {
      actionType = 'add_part_evidence'
      changeDescription = `added evidence: ${validated.evidence.content.substring(0, 50)}...`
    }

    // Use action logger for UPDATE with rollback capability
    const { actionLogger } = await import('../database/action-logger')
    const data = await actionLogger.loggedUpdate<PartRow>(
      'parts',
      validated.partId,
      updates as any,
      userId,
      actionType as any,
      {
        partName: currentPart.name,
        changeDescription,
        confidenceDelta: validated.updates.confidenceBoost,
        categoryChange: validated.updates.category
          ? {
              from: currentPart.category,
              to: validated.updates.category,
            }
          : undefined,
        evidenceAdded: !!validated.evidence,
        fieldChanged: Object.keys(validated.updates).join(', '),
        auditNote: validated.auditNote,
      }
    )

    return data
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

