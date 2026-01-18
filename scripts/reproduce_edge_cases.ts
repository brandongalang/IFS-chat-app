
import path from 'node:path'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { config as loadEnv } from 'dotenv'
import { getServiceClient } from '@/lib/supabase/clients'
import { createEmergingPart, logRelationship } from '@/lib/data/schema/parts-agent'
import { createChatSessionService } from '@/lib/session-service'
import { SessionMessage } from '@/lib/types/database'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })
loadEnv({ path: path.resolve(process.cwd(), '.env') })

async function main() {
  const supabase = getServiceClient()

  const { data: users } = await supabase.from('users').select('id').limit(1)
  if (!users || users.length === 0) {
      console.error('No users found.')
      process.exit(1)
  }
  const userId = users[0].id
  console.log(`Using User ID: ${userId}`)

  console.log('\n--- Testing Part Name Uniqueness ---')
  const partName = `TestPart_${Date.now()}`
  const partNameLower = partName.toLowerCase()
  const timestamp = new Date().toISOString()
  const sessionId = randomUUID()

  const mockEvidence = [
        { content: 'Ev1', confidence: 0.8, type: 'behavior' as const, sessionId, timestamp },
        { content: 'Ev2', confidence: 0.8, type: 'pattern' as const, sessionId, timestamp },
        { content: 'Ev3', confidence: 0.8, type: 'direct_mention' as const, sessionId, timestamp }
  ]

  const input = {
      name: partName,
      evidence: mockEvidence,
      userConfirmed: true
  }
  // console.log('Input:', JSON.stringify(input, null, 2))

  try {
    console.log(`Creating part: ${partName}`)
    const part1 = await createEmergingPart(input, { client: supabase, userId })
    console.log(`Created part 1 ID: ${part1.id}`)

    console.log(`Creating duplicate part (lower case): ${partNameLower}`)
    try {
        const part2 = await createEmergingPart({
          ...input,
          name: partNameLower
        }, { client: supabase, userId })
        console.log(`Created part 2 ID: ${part2.id}`)
        console.log('FAIL: Duplicate part created (case variant allowed)')
    } catch (e: any) {
        if (e.message.includes('already exists')) {
             console.log(`SUCCESS: Duplicate part creation failed: ${e.message}`)
        } else {
             console.log(`FAIL: Creation failed with unexpected error: ${e.message}`)
        }
    }
  } catch (e: any) {
    console.error('Error during part test:', e.message)
    console.error(JSON.stringify(e, null, 2))
  }

  console.log('\n--- Testing Self-Referential Relationship ---')
  try {
    const partNameRef = `TestPartRef_${Date.now()}`
    const part = await createEmergingPart({
        name: partNameRef,
        evidence: mockEvidence,
        userConfirmed: true
      }, { client: supabase, userId })

    console.log(`Attempting to link part ${part.id} to itself...`)
    try {
        await logRelationship({
            partIds: [part.id, part.id],
            type: 'polarized',
            description: 'Self protection'
        }, { client: supabase, userId })
        console.log('FAIL: Self-referential relationship created')
    } catch (e: any) {
         if (e.message.includes('Self-referential')) {
             console.log(`SUCCESS: Relationship creation failed: ${e.message}`)
         } else {
             console.log(`FAIL: Relationship creation failed with unexpected error: ${e.message}`)
         }
    }

  } catch (e: any) {
      console.error('Error during relationship test:', e.message)
  }

  console.log('\n--- Testing Chat Session Race Condition ---')
  try {
      const service = createChatSessionService({ supabase, userId })
      const chatSessionId = await service.startSession()
      console.log(`Started session: ${chatSessionId}`)

      const messagesToSend = 5
      const promises = []
      for (let i = 0; i < messagesToSend; i++) {
          const msg: Omit<SessionMessage, 'timestamp'> = {
              role: 'user',
              content: `Message ${i}`,
              id: `msg-${i}`
          }
          promises.push(service.addMessage(chatSessionId, msg))
      }

      await Promise.all(promises)
      console.log('Finished sending messages concurrently.')

      const messages = await service.getSessionMessages(chatSessionId)
      console.log(`Total messages in transcript: ${messages.length}`)
      if (messages.length !== messagesToSend) {
          console.log(`FAIL: Race condition detected! Expected ${messagesToSend}, got ${messages.length}`)
      } else {
          console.log('SUCCESS: No race condition detected.')
      }

  } catch (e: any) {
      console.error('Error during chat test:', e.message)
  }
}

main().catch(console.error)
