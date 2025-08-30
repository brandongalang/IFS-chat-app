import { createTool } from '@mastra/core'
import { z } from 'zod'
import { actionLogger } from '../../lib/database/action-logger'
import { resolveUserId } from '@/config/dev'
import type { Database, PartRow, PartInsert, ToolResult } from '../../lib/types/database'
import { createClient as createBrowserClient } from '@supabase/supabase-js'

// Helper function to get Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase URL and anon key are required.')
  }

  return createBrowserClient<Database>(url, anonKey)
}

const createPartStubSchema = z.object({
  name: z.string().min(1).max(100).describe('Name of the emerging part stub'),
  evidenceContent: z.string().min(1).describe('The single piece of evidence content for creating the stub'),
  sessionId: z.string().uuid().describe('The session ID where the evidence was observed'),
  userId: z.string().uuid().optional().describe('User ID who owns the part (optional in development mode)')
})

export async function createPartStub(input: z.infer<typeof createPartStubSchema>): Promise<ToolResult<PartRow>> {
  try {
    const validated = createPartStubSchema.parse(input)
    const userId = resolveUserId(validated.userId)
    const supabase = getSupabaseClient()
    const now = new Date().toISOString()

    // Check if part with same name already exists for this user
    const { data: existingPart } = await supabase
      .from('parts')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', validated.name)
      .single()

    if (existingPart) {
      return {
        success: false,
        error: `A part named "${validated.name}" already exists for this user. Use logEvidence instead.`
      }
    }

    const evidence = {
        type: 'direct_mention',
        content: validated.evidenceContent,
        confidence: 0.5, // Default confidence for a single piece of evidence
        sessionId: validated.sessionId,
        timestamp: now
    }

    const partInsert: PartInsert = {
      user_id: userId,
      name: validated.name,
      status: 'emerging',
      category: 'unknown',
      confidence: 0.1, // Very low confidence for a stub
      evidence_count: 1,
      recent_evidence: [evidence],
      story: {
        origin: null,
        currentState: `Part stub created from initial evidence: "${validated.evidenceContent}"`,
        purpose: null,
        evolution: [{
          timestamp: now,
          change: 'Part stub created',
          trigger: 'Agent action via createPartStub'
        }]
      },
      visualization: {
        emoji: '🌱',
        color: '#A0A0A0',
        energyLevel: 0.3
      }
    }

    const data = await actionLogger.loggedInsert<PartRow>(
      'parts',
      partInsert,
      userId,
      'create_emerging_part', // Using existing action type for consistency
      {
        partName: validated.name,
        changeDescription: `Created part stub for "${validated.name}"`,
        sessionId: validated.sessionId,
        evidenceCount: 1,
        category: 'unknown',
        confidence: 0.1
      }
    )

    return {
      success: true,
      data,
      confidence: 0.1
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    return { success: false, error: errMsg }
  }
}

export const createPartStubTool = createTool({
  id: 'createPartStub',
  description: "Creates a lightweight 'stub' of a new part with minimal information and a low confidence score. Use this when a part is mentioned for the first time to get a partId for future operations.",
  inputSchema: createPartStubSchema,
  execute: async ({ context }) => {
    const result = await createPartStub(context)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result.data
  }
})

export const stubTools = {
    createPartStub: createPartStubTool
}
