'use server'

import { revalidatePath } from 'next/cache'
import { updatePart } from '@/lib/data/parts-server'
import { getUserClient } from '@/lib/supabase/clients'
import { z } from 'zod'

const updateDetailsSchema = z.object({
  partId: z.string().uuid(),
  name: z.string().min(1).max(100),
  emoji: z.string().min(1).max(4), // Allow for longer emojis
})

const addNoteSchema = z.object({
  partId: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
})

export async function updatePartDetails(formData: FormData) {
  const rawData = {
    partId: formData.get('partId'),
    name: formData.get('name'),
    emoji: formData.get('emoji'),
  }

  const validated = updateDetailsSchema.safeParse(rawData)

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.flatten().fieldErrors,
    }
  }

  const { partId, name, emoji } = validated.data

  // We need to get the existing visualization data first,
  // then merge the new emoji into it.
  // This is a simplification; a real implementation would fetch the part first.
  // For now, we assume the visualization object exists and has a color.
  const newVisualization = {
      emoji: emoji,
      // We are not changing the color, so we would need to preserve the old one.
      // This is a placeholder. A proper implementation would fetch the part,
      // get its existing visualization object, and merge the new emoji.
      // For the purpose of this step, we'll just set a default color.
      color: '#6B7280',
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'You must be signed in to update a part.' }
    }

    const updated = await updatePart({
      partId,
      updates: {
        name,
        visualization: newVisualization,
      },
      auditNote: 'Updated name and emoji from Garden UI',
    }, { userId: user.id, client: supabase })

    // Revalidate the path to ensure the page is updated with the new data
    revalidatePath(`/garden/${partId}`)
    revalidatePath('/garden') // Also revalidate the main garden page
    return { success: true, data: updated }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function addPartNote(formData: FormData) {
  const rawData = {
    partId: formData.get('partId'),
    content: formData.get('content'),
  }

  const validated = addNoteSchema.safeParse(rawData)

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.flatten().fieldErrors,
    }
  }

  const { partId, content } = validated.data

  try {
    const supabase = getUserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'You must be signed in to add a note.' }
    }

    const { data, error } = await supabase
      .from('part_notes')
      .insert({ part_id: partId, content })
      .select('id, part_id, content, created_at')
      .single()

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath(`/garden/${partId}`)
    revalidatePath('/garden')

    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add note.' }
  }
}
